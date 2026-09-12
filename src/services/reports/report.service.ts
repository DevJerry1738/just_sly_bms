import { productsRepository } from "@/repositories/entity.repositories";
import { wholesaleOrderRepository } from "@/repositories/wholesale-order.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { salesRepository } from "@/repositories/entity.repositories";
import { db, type SalesSchema, type WholesaleOrderSchema, type SaleItemSchema, type WholesaleOrderItemSchema } from "@/database/schema";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";

export interface TimeSeriesPoint {
  date: string;
  label: string;
  timestamp: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  totalRevenue: number;
  retailOrders: number;
  wholesaleOrders: number;
  totalOrders: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number; // percentage (0 - 100)
}

export interface TopProductMetric {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface SalesAnalytics {
  totalRevenue: number;
  posRevenue: number;
  wholesaleRevenue: number;
  totalCost: number;             // COGS
  grossProfit: number;           // totalRevenue - totalCost
  grossMarginPercent: number;    // (grossProfit / totalRevenue) * 100
  totalOrders: number;
  posOrdersCount: number;
  wholesaleOrdersCount: number;
  averageOrderValue: number;
  posAverageOrderValue: number;
  wholesaleAverageOrderValue: number;
  topProducts: TopProductMetric[];
  timeSeries: TimeSeriesPoint[];
}

export interface InventoryAnalytics {
  totalItems: number;
  totalUnits: number;
  totalValuationCost: number;
  lowStockItemsCount: number;
  expiredBatchesCount: number;
  expiringSoonBatchesCount: number; // Expiries within 30 days
  categoryBreakdown: Array<{ category: string; count: number; totalValue: number }>;
}

export interface WholesaleAnalytics {
  totalWholesaleOrders: number;
  pendingPaymentCount: number;
  confirmedCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  totalRevenue: number;
  totalWholesaleCost: number;
  wholesaleGrossProfit: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

export interface DateFilterOptions {
  startDate?: number;
  endDate?: number;
  branchId?: string;
  daysCount?: number;
}

class ReportService {
  /**
   * Aggregate Comprehensive Sales & Profitability Analytics across POS sales and Wholesale orders
   */
  async getSalesAnalytics(filters?: DateFilterOptions): Promise<SalesAnalytics> {
    try {
      const { startDate, endDate, branchId, daysCount = 7 } = filters || {};

      const [allSales, allSaleItems, allWholesaleOrders, allWholesaleItems, products, categories] = await Promise.all([
        salesRepository.getAll().catch(() => []),
        db.sale_items.toArray().catch(() => []),
        wholesaleOrderRepository.getAll().catch(() => []),
        db.wholesale_order_items.toArray().catch(() => []),
        productsRepository.getAll().catch(() => []),
        db.categories.toArray().catch(() => []),
      ]);

      const productMap = new Map((products || []).map((p) => [p.id, p]));

      // 1. Filter POS Sales
      const filteredSales = (allSales || []).filter((s: SalesSchema) => {
        if (branchId && s.branchId !== branchId) return false;
        if (startDate && s.createdAt < startDate) return false;
        if (endDate && s.createdAt > endDate) return false;
        return s.status === "completed";
      });

      // 2. Filter Wholesale Orders
      const filteredWholesale = (allWholesaleOrders || []).filter((w: WholesaleOrderSchema) => {
        if (branchId && w.hqBranchId !== branchId) return false;
        if (startDate && w.createdAt < startDate) return false;
        if (endDate && w.createdAt > endDate) return false;
        return w.status !== "cancelled" && w.paymentStatus === "confirmed";
      });

      const validSaleIds = new Set(filteredSales.map((s) => s.id));
      const validWholesaleIds = new Set(filteredWholesale.map((w) => w.id));

      const filteredSaleItems = allSaleItems.filter((i) => validSaleIds.has(i.saleId));
      const filteredWholesaleItems = allWholesaleItems.filter((i) => validWholesaleIds.has(i.orderId));

      // Calculate Revenues
      const posRevenue = filteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
      const wholesaleRevenue = filteredWholesale.reduce((acc, w) => acc + (w.totalAmount || 0), 0);
      const totalRevenue = posRevenue + wholesaleRevenue;

      // Calculate Costs (COGS)
      const posCost = filteredSaleItems.reduce((acc, item) => {
        const unitCost = item.costPrice || (productMap.get(item.productId)?.costPrice ?? 0);
        return acc + unitCost * (item.baseQuantity || item.quantity || 1);
      }, 0);

      const wholesaleCost = filteredWholesaleItems.reduce((acc, item) => {
        const unitCost = item.costPriceSnapshot || (productMap.get(item.productId)?.costPrice ?? 0);
        return acc + unitCost * (item.baseQuantity || item.quantity || 1);
      }, 0);

      const totalCost = posCost + wholesaleCost;
      const grossProfit = totalRevenue - totalCost;
      const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Order counts & AOV
      const posOrdersCount = filteredSales.length;
      const wholesaleOrdersCount = filteredWholesale.length;
      const totalOrders = posOrdersCount + wholesaleOrdersCount;

      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const posAverageOrderValue = posOrdersCount > 0 ? posRevenue / posOrdersCount : 0;
      const wholesaleAverageOrderValue = wholesaleOrdersCount > 0 ? wholesaleRevenue / wholesaleOrdersCount : 0;

      // 3. Product Profitability Leaderboard
      const productPerformanceMap = new Map<
        string,
        { quantitySold: number; revenue: number; cost: number; name: string; sku: string }
      >();

      for (const item of filteredSaleItems) {
        const prod = productMap.get(item.productId);
        const unitCost = item.costPrice || (prod?.costPrice ?? 0);
        const current = productPerformanceMap.get(item.productId) || {
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          name: item.productName || prod?.name || "Product",
          sku: prod?.sku || item.productId.slice(0, 8),
        };
        const qty = item.quantity || 1;
        const lineRevenue = item.subtotal || (item.unitPrice || 0) * qty;
        const lineCost = unitCost * (item.baseQuantity || qty);

        current.quantitySold += qty;
        current.revenue += lineRevenue;
        current.cost += lineCost;
        productPerformanceMap.set(item.productId, current);
      }

      for (const item of filteredWholesaleItems) {
        const prod = productMap.get(item.productId);
        const unitCost = item.costPriceSnapshot || (prod?.costPrice ?? 0);
        const current = productPerformanceMap.get(item.productId) || {
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          name: item.productName || prod?.name || "Product",
          sku: item.sku || prod?.sku || item.productId.slice(0, 8),
        };
        const qty = item.quantity || 1;
        const lineRevenue = item.subtotal || (item.unitPriceSnapshot || 0) * qty;
        const lineCost = unitCost * (item.baseQuantity || qty);

        current.quantitySold += qty;
        current.revenue += lineRevenue;
        current.cost += lineCost;
        productPerformanceMap.set(item.productId, current);
      }

      const topProducts: TopProductMetric[] = Array.from(productPerformanceMap.entries())
        .map(([productId, val]) => {
          const profit = val.revenue - val.cost;
          const margin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;
          return {
            productId,
            productName: val.name,
            sku: val.sku,
            quantitySold: val.quantitySold,
            revenue: val.revenue,
            cost: val.cost,
            profit,
            margin,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // 4. Time Series Generation
      const now = new Date();
      const numDays = Math.max(1, Math.min(daysCount, 90));
      const timeSeries: TimeSeriesPoint[] = Array.from({ length: numDays }).map((_, idx) => {
        const dayDate = subDays(now, numDays - 1 - idx);
        const dayStart = startOfDay(dayDate).getTime();
        const dayEnd = endOfDay(dayDate).getTime();

        const daySales = filteredSales.filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd);
        const dayWholesale = filteredWholesale.filter((w) => w.createdAt >= dayStart && w.createdAt <= dayEnd);

        const daySaleIds = new Set(daySales.map((s) => s.id));
        const dayWholesaleIds = new Set(dayWholesale.map((w) => w.id));

        const daySaleItems = filteredSaleItems.filter((i) => daySaleIds.has(i.saleId));
        const dayWholesaleItems = filteredWholesaleItems.filter((i) => dayWholesaleIds.has(i.orderId));

        const dayRetailRev = daySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
        const dayWholesaleRev = dayWholesale.reduce((acc, w) => acc + (w.totalAmount || 0), 0);
        const dayTotalRev = dayRetailRev + dayWholesaleRev;

        const dayRetailCost = daySaleItems.reduce((acc, item) => {
          const unitCost = item.costPrice || (productMap.get(item.productId)?.costPrice ?? 0);
          return acc + unitCost * (item.baseQuantity || item.quantity || 1);
        }, 0);

        const dayWholesaleCost = dayWholesaleItems.reduce((acc, item) => {
          const unitCost = item.costPriceSnapshot || (productMap.get(item.productId)?.costPrice ?? 0);
          return acc + unitCost * (item.baseQuantity || item.quantity || 1);
        }, 0);

        const dayTotalCost = dayRetailCost + dayWholesaleCost;
        const dayGrossProfit = dayTotalRev - dayTotalCost;
        const dayMargin = dayTotalRev > 0 ? (dayGrossProfit / dayTotalRev) * 100 : 0;

        return {
          date: format(dayDate, "yyyy-MM-dd"),
          label: numDays <= 14 ? format(dayDate, "EEE dd") : format(dayDate, "MMM dd"),
          timestamp: dayStart,
          retailRevenue: dayRetailRev,
          wholesaleRevenue: dayWholesaleRev,
          totalRevenue: dayTotalRev,
          retailOrders: daySales.length,
          wholesaleOrders: dayWholesale.length,
          totalOrders: daySales.length + dayWholesale.length,
          cogs: dayTotalCost,
          grossProfit: dayGrossProfit,
          grossMargin: dayMargin,
        };
      });

      return {
        totalRevenue,
        posRevenue,
        wholesaleRevenue,
        totalCost,
        grossProfit,
        grossMarginPercent,
        totalOrders,
        posOrdersCount,
        wholesaleOrdersCount,
        averageOrderValue,
        posAverageOrderValue,
        wholesaleAverageOrderValue,
        topProducts,
        timeSeries,
      };
    } catch (err) {
      console.error("[ReportService] Failed to calculate sales analytics:", err);
      return {
        totalRevenue: 0,
        posRevenue: 0,
        wholesaleRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
        totalOrders: 0,
        posOrdersCount: 0,
        wholesaleOrdersCount: 0,
        averageOrderValue: 0,
        posAverageOrderValue: 0,
        wholesaleAverageOrderValue: 0,
        topProducts: [],
        timeSeries: [],
      };
    }
  }

  /**
   * Aggregate Inventory Valuation & Expiry Analytics
   */
  async getInventoryAnalytics(): Promise<InventoryAnalytics> {
    try {
      const [balances, batches, products] = await Promise.all([
        inventoryBalanceRepository.getAll().catch(() => []),
        inventoryBatchRepository.getAll().catch(() => []),
        productsRepository.getAll().catch(() => []),
      ]);

      const productMap = new Map((products || []).map((p) => [p.id, p]));

      let totalUnits = 0;
      let totalValuationCost = 0;
      let lowStockItemsCount = 0;

      const categoryMap = new Map<string, { count: number; totalValue: number }>();

      for (const bal of balances || []) {
        const product = productMap.get(bal.productId);
        const costPrice = product?.costPrice || 0;
        const reorderLevel = product?.lowStockThreshold || 10;

        totalUnits += bal.quantityOnHand || 0;
        const valCost = (bal.quantityOnHand || 0) * costPrice;
        totalValuationCost += valCost;

        if ((bal.quantityOnHand || 0) <= reorderLevel) {
          lowStockItemsCount++;
        }

        const catName = product?.categoryId || "Uncategorized";
        const currentCat = categoryMap.get(catName) || { count: 0, totalValue: 0 };
        categoryMap.set(catName, {
          count: currentCat.count + 1,
          totalValue: currentCat.totalValue + valCost,
        });
      }

      const nowIso = new Date().toISOString().slice(0, 10);
      const thirtyDaysFromNowIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      let expiredBatchesCount = 0;
      let expiringSoonBatchesCount = 0;

      for (const batch of batches || []) {
        if (batch.expiryDate) {
          if (batch.expiryDate <= nowIso) {
            expiredBatchesCount++;
          } else if (batch.expiryDate <= thirtyDaysFromNowIso) {
            expiringSoonBatchesCount++;
          }
        }
      }

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, val]) => ({
        category,
        count: val.count,
        totalValue: val.totalValue,
      }));

      return {
        totalItems: (products || []).length,
        totalUnits,
        totalValuationCost,
        lowStockItemsCount,
        expiredBatchesCount,
        expiringSoonBatchesCount,
        categoryBreakdown,
      };
    } catch (err) {
      console.error("[ReportService] Failed to calculate inventory analytics:", err);
      return {
        totalItems: 0,
        totalUnits: 0,
        totalValuationCost: 0,
        lowStockItemsCount: 0,
        expiredBatchesCount: 0,
        expiringSoonBatchesCount: 0,
        categoryBreakdown: [],
      };
    }
  }

  /**
   * Aggregate Wholesale performance & Customer Leaderboard
   */
  async getWholesaleAnalytics(filters?: DateFilterOptions): Promise<WholesaleAnalytics> {
    try {
      const { startDate, endDate } = filters || {};

      const [orders, customers] = await Promise.all([
        wholesaleOrderRepository.getAll().catch(() => []),
        customerRepository.getAll().catch(() => []),
      ]);

      const customerMap = new Map((customers || []).map((c) => [c.id, c.businessName || c.contactName]));

      const filtered = (orders || []).filter((o) => {
        if (startDate && o.createdAt < startDate) return false;
        if (endDate && o.createdAt > endDate) return false;
        return true;
      });

      let pendingPaymentCount = 0;
      let confirmedCount = 0;
      let fulfilledCount = 0;
      let cancelledCount = 0;
      let totalRevenue = 0;

      const customerSpentMap = new Map<string, { totalOrders: number; totalSpent: number }>();

      for (const order of filtered) {
        if (order.status === "pending_payment" || order.status === "payment_submitted") {
          pendingPaymentCount++;
        } else if (order.status === "payment_confirmed" || order.status === "processing" || order.status === "ready") {
          confirmedCount++;
        } else if (order.status === "dispatched" || order.status === "delivered") {
          fulfilledCount++;
          totalRevenue += order.totalAmount || 0;
        } else if (order.status === "cancelled") {
          cancelledCount++;
        }

        if (order.status !== "cancelled") {
          const current = customerSpentMap.get(order.customerId) || { totalOrders: 0, totalSpent: 0 };
          customerSpentMap.set(order.customerId, {
            totalOrders: current.totalOrders + 1,
            totalSpent: current.totalSpent + (order.totalAmount || 0),
          });
        }
      }

      const topCustomers = Array.from(customerSpentMap.entries())
        .map(([customerId, val]) => ({
          customerId,
          customerName: customerMap.get(customerId) || `Customer (${customerId.slice(0, 6)})`,
          totalOrders: val.totalOrders,
          totalSpent: val.totalSpent,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      return {
        totalWholesaleOrders: filtered.length,
        pendingPaymentCount,
        confirmedCount,
        fulfilledCount,
        cancelledCount,
        totalRevenue,
        totalWholesaleCost: 0,
        wholesaleGrossProfit: totalRevenue,
        topCustomers,
      };
    } catch (err) {
      console.error("[ReportService] Failed to calculate wholesale analytics:", err);
      return {
        totalWholesaleOrders: 0,
        pendingPaymentCount: 0,
        confirmedCount: 0,
        fulfilledCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        totalWholesaleCost: 0,
        wholesaleGrossProfit: 0,
        topCustomers: [],
      };
    }
  }

  /**
   * Utility method to generate CSV download
   */
  exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const reportService = new ReportService();
