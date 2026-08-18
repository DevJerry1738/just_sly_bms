import { productsRepository } from "@/repositories/entity.repositories";
import { wholesaleOrderRepository } from "@/repositories/wholesale-order.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { salesRepository } from "@/repositories/entity.repositories";
import type { SalesSchema, WholesaleOrderSchema } from "@/database/schema";

export interface SalesAnalytics {
  totalRevenue: number;
  posRevenue: number;
  wholesaleRevenue: number;
  totalOrders: number;
  posOrdersCount: number;
  wholesaleOrdersCount: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
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
}

class ReportService {
  /**
   * Aggregate Sales Analytics across POS sales and Wholesale orders
   */
  async getSalesAnalytics(filters?: DateFilterOptions): Promise<SalesAnalytics> {
    try {
      const { startDate, endDate } = filters || {};

      const [allSales, allWholesaleOrders, products] = await Promise.all([
        salesRepository.getAll().catch(() => []),
        wholesaleOrderRepository.getAll().catch(() => []),
        productsRepository.getAll().catch(() => []),
      ]);

      const productMap = new Map<string, string>((products || []).map((p) => [p.id, p.name]));

      // Filter POS Sales
      const filteredSales = (allSales || []).filter((s: SalesSchema) => {
        if (startDate && s.createdAt < startDate) return false;
        if (endDate && s.createdAt > endDate) return false;
        return s.status !== "voided";
      });

      // Filter Wholesale Orders
      const filteredWholesale = (allWholesaleOrders || []).filter((w: WholesaleOrderSchema) => {
        if (startDate && w.createdAt < startDate) return false;
        if (endDate && w.createdAt > endDate) return false;
        return w.status !== "cancelled";
      });

      const posRevenue = filteredSales.reduce((acc: number, item: SalesSchema) => acc + ((item.totalAmount as number) || 0), 0);
      const wholesaleRevenue = filteredWholesale.reduce((acc: number, item: WholesaleOrderSchema) => acc + (item.totalAmount || 0), 0);
      const totalRevenue = posRevenue + wholesaleRevenue;

      const posOrdersCount = filteredSales.length;
      const wholesaleOrdersCount = filteredWholesale.length;
      const totalOrders = posOrdersCount + wholesaleOrdersCount;

      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Track product sales revenue & quantity
      const productSalesMap = new Map<string, { quantitySold: number; revenue: number }>();

      for (const sale of filteredSales) {
        const items = (sale as Record<string, unknown>).items;
        if (items && Array.isArray(items)) {
          for (const item of items) {
            const current = productSalesMap.get(item.productId) || { quantitySold: 0, revenue: 0 };
            productSalesMap.set(item.productId, {
              quantitySold: current.quantitySold + (item.quantity || 0),
              revenue: current.revenue + (item.subtotal || 0),
            });
          }
        }
      }

      const topProducts: Array<{ productId: string; productName: string; quantitySold: number; revenue: number }> = Array.from(productSalesMap.entries())
        .map(([productId, val]) => ({
          productId,
          productName: productMap.get(productId) || `Product (${productId.slice(0, 6)})`,
          quantitySold: val.quantitySold,
          revenue: val.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return {
        totalRevenue,
        posRevenue,
        wholesaleRevenue,
        totalOrders,
        posOrdersCount,
        wholesaleOrdersCount,
        averageOrderValue,
        topProducts,
      };
    } catch (err) {
      console.error("[ReportService] Failed to calculate sales analytics:", err);
      return {
        totalRevenue: 0,
        posRevenue: 0,
        wholesaleRevenue: 0,
        totalOrders: 0,
        posOrdersCount: 0,
        wholesaleOrdersCount: 0,
        averageOrderValue: 0,
        topProducts: [],
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
