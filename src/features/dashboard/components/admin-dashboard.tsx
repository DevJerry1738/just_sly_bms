import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { formatSafe } from "@/lib/format-date";
import {
  TrendingUp,
  ShoppingCart,
  Truck,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  AlertTriangle,
  Clock,
  Plus,
  Building2,
  Users,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import { db, type SalesSchema, type WholesaleOrderSchema, type AuditLogSchema, type BranchSchema, type InventoryBalanceSchema, type ProductSchema } from "@/database/schema";
import { branchRepository } from "@/repositories/branch.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardsSkeleton } from "@/components/common/skeletons";

interface BranchMetrics {
  branchId: string;
  name: string;
  code: string;
  salesCount: number;
  revenue: number;
  totalStock: number;
  lowStockCount: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBranch, branches, setActiveBranchId } = useBranch();
  const { hasPermission } = useAuthorization();

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d">("today");
  const [chartMetric, setChartMetric] = useState<"revenue" | "sales" | "retail" | "wholesale">("revenue");

  // Metrics State
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [salesDelta, setSalesDelta] = useState(0);
  const [wholesaleCount, setWholesaleCount] = useState(0);
  const [wholesaleAwaitingPayment, setWholesaleAwaitingPayment] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingSuppliesCount, setPendingSuppliesCount] = useState(0);
  const [pendingTransfersCount, setPendingTransfersCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStockUnits, setTotalStockUnits] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);

  // Lists & Analytics Data
  const [branchPerformance, setBranchPerformance] = useState<BranchMetrics[]>([]);
  const [bestSellers, setBestSellers] = useState<{ id: string; name: string; sku: string; unitsSold: number; revenue: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; count: number; units: number }[]>([]);
  const [recentActivities, setRecentActivities] = useState<AuditLogSchema[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ label: string; retail: number; wholesale: number; total: number }[]>([]);

  const firstName = user?.email?.split("@")[0] ?? "Admin";

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = startOfDay(now).getTime();
      const todayEnd = endOfDay(now).getTime();
      const yesterdayStart = startOfDay(subDays(now, 1)).getTime();
      const yesterdayEnd = endOfDay(subDays(now, 1)).getTime();

      // Fetch base datasets from IndexedDB
      const [allSales, allWholesale, allProducts, allBalances, allBatches, allTransfers, allAuditLogs, allCategories] =
        await Promise.all([
          db.sales.toArray(),
          db.wholesale_orders.toArray(),
          db.products.toArray(),
          db.inventory_balances.toArray(),
          db.inventory_batches.toArray(),
          db.inventory_transfers.toArray(),
          auditLogRepository.getRecentLogs(15),
          db.categories.toArray(),
        ]);

      // Filter by Active Branch context if not "ALL"
      const branchId = activeBranch?.id;
      const sales = branchId ? allSales.filter((s) => s.branchId === branchId) : allSales;
      const wholesale = branchId ? allWholesale.filter((w) => w.hqBranchId === branchId) : allWholesale;
      const balances = branchId ? allBalances.filter((b) => b.branchId === branchId) : allBalances;
      const batches = branchId ? allBatches.filter((b) => b.branchId === branchId) : allBatches;
      const transfers = branchId
        ? allTransfers.filter((t) => t.sourceBranchId === branchId || t.destinationBranchId === branchId)
        : allTransfers;

      // 1. Today's Revenue & Sales Count
      const todaySales = sales.filter((s) => s.createdAt >= todayStart && s.createdAt <= todayEnd && s.status === "completed");
      const yesterdaySales = sales.filter((s) => s.createdAt >= yesterdayStart && s.createdAt <= yesterdayEnd && s.status === "completed");

      const todayRevVal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const yesterdayRevVal = yesterdaySales.reduce((sum, s) => sum + s.totalAmount, 0);
      setTodayRevenue(todayRevVal);
      setRevenueDelta(yesterdayRevVal > 0 ? ((todayRevVal - yesterdayRevVal) / yesterdayRevVal) * 100 : 0);

      setTodaySalesCount(todaySales.length);
      setSalesDelta(yesterdaySales.length > 0 ? ((todaySales.length - yesterdaySales.length) / yesterdaySales.length) * 100 : 0);

      // 2. Wholesale Orders
      setWholesaleCount(wholesale.length);
      setWholesaleAwaitingPayment(wholesale.filter((w) => w.status === "pending_payment" || w.status === "payment_submitted").length);

      // 3. Low Stock & Inventory Snapshot
      const lowStockItems = balances.filter((b) => {
        const product = allProducts.find((p) => p.id === b.productId);
        const threshold = product?.lowStockThreshold ?? 5;
        return b.quantityOnHand <= threshold;
      });
      setLowStockCount(lowStockItems.length);

      setTotalProducts(allProducts.filter((p) => p.status === "active").length);
      const totalUnits = balances.reduce((sum, b) => sum + b.quantityOnHand, 0);
      setTotalStockUnits(totalUnits);

      // Expiring batches (within 30 days)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const expiring = batches.filter((b) => {
        if (!b.expiryDate) return false;
        const expiryTime = new Date(b.expiryDate).getTime();
        return expiryTime - nowMs <= thirtyDaysMs && expiryTime > nowMs;
      });
      setExpiringSoonCount(expiring.length);

      // 4. Pending Supplies & Transfers
      const pendingTrans = transfers.filter((t) => t.status === "pending_dispatch" || t.status === "dispatched" || t.status === "in_transit");
      setPendingTransfersCount(pendingTrans.filter((t) => t.transferType === "branch_transfer").length);
      setPendingSuppliesCount(pendingTrans.filter((t) => t.transferType === "hq_supply").length);

      // 5. Branch Performance Breakdown
      const branchStats: BranchMetrics[] = branches.map((b) => {
        const bSales = allSales.filter((s) => s.branchId === b.id && s.status === "completed");
        const bRev = bSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const bBal = allBalances.filter((bal) => bal.branchId === b.id);
        const bStock = bBal.reduce((sum, bal) => sum + bal.quantityOnHand, 0);
        const bLow = bBal.filter((bal) => {
          const prod = allProducts.find((p) => p.id === bal.productId);
          return bal.quantityOnHand <= (prod?.lowStockThreshold ?? 5);
        }).length;

        return {
          branchId: b.id,
          name: b.name,
          code: b.code,
          salesCount: bSales.length,
          revenue: bRev,
          totalStock: bStock,
          lowStockCount: bLow,
        };
      });
      setBranchPerformance(branchStats);

      // 6. Best Sellers Calculation
      const saleItems = await db.sale_items.toArray();
      const productSalesMap = new Map<string, { name: string; sku: string; unitsSold: number; revenue: number }>();

      saleItems.forEach((item) => {
        const prod = allProducts.find((p) => p.id === item.productId);
        const skuStr = prod?.sku || item.productId.slice(0, 8);
        const existing = productSalesMap.get(item.productId) || {
          name: item.productName,
          sku: skuStr,
          unitsSold: 0,
          revenue: 0,
        };
        existing.unitsSold += item.quantity;
        existing.revenue += item.subtotal;
        productSalesMap.set(item.productId, existing);
      });

      const sortedSellers = Array.from(productSalesMap.entries())
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 5);
      setBestSellers(sortedSellers);

      // 7. Inventory by Category
      const catMap = new Map<string, { category: string; count: number; units: number }>();
      allCategories.forEach((c) => catMap.set(c.id, { category: c.name, count: 0, units: 0 }));

      allProducts.forEach((p) => {
        if (!p.categoryId) return;
        const cat = catMap.get(p.categoryId);
        if (cat) {
          cat.count += 1;
          const pBalances = balances.filter((b) => b.productId === p.id);
          cat.units += pBalances.reduce((sum, b) => sum + b.quantityOnHand, 0);
        }
      });
      setCategoryBreakdown(Array.from(catMap.values()).filter((c) => c.count > 0));

      // 8. Recent Domain Activities
      setRecentActivities(allAuditLogs.slice(0, 6));

      // 9. Chart Trend Data (Last 7 Days)
      const chartPoints = Array.from({ length: 7 }).map((_, idx) => {
        const d = subDays(now, 6 - idx);
        const dayStart = startOfDay(d).getTime();
        const dayEnd = endOfDay(d).getTime();

        const dayRetail = sales
          .filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd && s.status === "completed")
          .reduce((sum, s) => sum + s.totalAmount, 0);

        const dayWholesale = wholesale
          .filter((w) => w.createdAt >= dayStart && w.createdAt <= dayEnd && w.paymentStatus === "confirmed")
          .reduce((sum, w) => sum + w.totalAmount, 0);

        return {
          label: format(d, "EEE dd"),
          retail: dayRetail,
          wholesale: dayWholesale,
          total: dayRetail + dayWholesale,
        };
      });
      setSalesChartData(chartPoints);
    } catch (err) {
      console.error("[AdminDashboard] Failed to load dashboard data:", err);
      toast.error("Failed to refresh dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, branches]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Admin Overview" description="Loading real-time enterprise metrics across Just Sly branches..." />
        <CardsSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Toolbar */}
      <PageHeader
        title={`Good morning, ${firstName}`}
        description="Here's what's happening across Just Sly today."
        actions={
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "today" | "7d" | "30d")}>
              <SelectTrigger className="h-8 text-xs font-medium w-28">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={loadDashboardData}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Today's Revenue"
          value={`₦${todayRevenue.toLocaleString()}`}
          hint={revenueDelta !== 0 ? `${revenueDelta > 0 ? "↑" : "↓"} ${Math.abs(revenueDelta).toFixed(1)}% vs yesterday` : "Same as yesterday"}
          delta={revenueDelta}
          icon={TrendingUp}
        />
        <StatCard
          label="Today's Sales"
          value={todaySalesCount.toString()}
          hint={salesDelta !== 0 ? `${salesDelta > 0 ? "↑" : "↓"} ${Math.abs(salesDelta).toFixed(1)}% vs yesterday` : "Completed sales"}
          delta={salesDelta}
          icon={ShoppingCart}
        />
        <StatCard
          label="Wholesale Orders"
          value={wholesaleCount.toString()}
          hint={`${wholesaleAwaitingPayment} awaiting payment`}
          icon={Truck}
        />
        <StatCard
          label="Low Stock Items"
          value={lowStockCount.toString()}
          hint="Products below threshold"
          icon={Boxes}
        />
        <StatCard
          label="Pending Supplies"
          value={pendingSuppliesCount.toString()}
          hint="Awaiting confirmation"
          icon={Package}
        />
        <StatCard
          label="Pending Transfers"
          value={pendingTransfersCount.toString()}
          hint="Require attention"
          icon={Building2}
        />
      </div>

      {/* Main Grid: Sales Chart & Attention Required */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sales Performance Chart */}
        <Card variant="flat" className="lg:col-span-8 border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Sales Performance Trend</CardTitle>
              <CardDescription className="text-xs">Retail POS & Wholesale revenue velocity over the last 7 days.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
              <Button
                variant={chartMetric === "revenue" ? "default" : "ghost"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setChartMetric("revenue")}
              >
                Revenue
              </Button>
              <Button
                variant={chartMetric === "retail" ? "default" : "ghost"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setChartMetric("retail")}
              >
                Retail
              </Button>
              <Button
                variant={chartMetric === "wholesale" ? "default" : "ghost"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setChartMetric("wholesale")}
              >
                Wholesale
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">₦{salesChartData.reduce((sum, d) => sum + d.total, 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">Total 7-Day Revenue</span>
              </div>

              {/* Bar visualization */}
              <div className="h-44 flex items-end justify-between gap-2 pt-6 border-b pb-2">
                {salesChartData.map((d, i) => {
                  const maxTotal = Math.max(...salesChartData.map((p) => p.total), 1);
                  const val = chartMetric === "retail" ? d.retail : chartMetric === "wholesale" ? d.wholesale : d.total;
                  const heightPct = Math.max((val / maxTotal) * 100, 8);

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="text-[10px] font-mono font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        ₦{(val / 1000).toFixed(0)}k
                      </div>
                      <div
                        className="w-full max-w-[36px] bg-primary/80 group-hover:bg-primary rounded-t transition-all"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">{d.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Retail Sales</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/40" /> Wholesale Orders</span>
                </div>
                <Link to="/analytics" className="text-xs text-primary font-medium flex items-center hover:underline">
                  Full Analytics <ChevronRight className="size-3 ml-0.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Needs Your Attention Feed */}
        <Card variant="flat" className="lg:col-span-4 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Needs Your Attention
            </CardTitle>
            <CardDescription className="text-xs">Operational bottlenecks requiring administrator intervention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockCount > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">🔴 {lowStockCount} Products Low in Stock</p>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400">Quantity below reorder threshold</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-700 dark:text-red-300" onClick={() => navigate({ to: "/inventory" })}>
                  View Inventory →
                </Button>
              </div>
            )}

            {pendingSuppliesCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">🟠 {pendingSuppliesCount} Branch Supplies Pending</p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400">Awaiting branch confirmation</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300" onClick={() => navigate({ to: "/inventory" })}>
                  Review →
                </Button>
              </div>
            )}

            {pendingTransfersCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">🟠 {pendingTransfersCount} Branch Transfers Pending</p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400">Inter-branch transfers active</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300" onClick={() => navigate({ to: "/inventory" })}>
                  Review →
                </Button>
              </div>
            )}

            {wholesaleAwaitingPayment > 0 && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">🟡 {wholesaleAwaitingPayment} Wholesale Orders Awaiting Payment</p>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-400">Payment confirmation required</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500/30 text-blue-800 dark:text-blue-300" onClick={() => navigate({ to: "/wholesale-orders" })}>
                  View Orders →
                </Button>
              </div>
            )}

            {lowStockCount === 0 && pendingSuppliesCount === 0 && pendingTransfersCount === 0 && wholesaleAwaitingPayment === 0 && (
              <div className="p-6 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-medium">All operations normal. No pending alerts.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Branch Performance Comparison Table */}
      <Card variant="flat" className="border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Branch Performance Summary</CardTitle>
            <CardDescription className="text-xs">Real-time revenue, transaction counts, and stock balances across all locations.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {branches.length} Registered Branches
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Branch Name</TableHead>
                  <TableHead className="text-xs text-right">Sales Count</TableHead>
                  <TableHead className="text-xs text-right">Total Revenue</TableHead>
                  <TableHead className="text-xs text-right">Stock (Units)</TableHead>
                  <TableHead className="text-xs text-right">Low Stock Count</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchPerformance.map((b) => (
                  <TableRow key={b.branchId} className="hover:bg-muted/30 text-xs">
                    <TableCell className="font-semibold">
                      <div>{b.name}</div>
                      <span className="text-[10px] text-muted-foreground font-mono">{b.code}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{b.salesCount}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      ₦{b.revenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">{b.totalStock.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">
                      {b.lowStockCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-mono">
                          {b.lowStockCount} items
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setActiveBranchId(b.branchId)}
                      >
                        Filter Context →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Best Sellers & Inventory Snapshot */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Best Sellers */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Selling Products</CardTitle>
            <CardDescription className="text-xs">Highest volume catalog items based on POS and Wholesale orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {bestSellers.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No sale items recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {bestSellers.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-card border rounded-lg hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono">{item.unitsSold} sold</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">₦{item.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Snapshot */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Inventory Snapshot</CardTitle>
            <CardDescription className="text-xs">Global product catalog metrics and batch expiration tracking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 border rounded-lg bg-card space-y-1">
                <p className="text-[11px] text-muted-foreground">Total Products</p>
                <p className="text-base font-bold font-mono">{totalProducts}</p>
              </div>
              <div className="p-3 border rounded-lg bg-card space-y-1">
                <p className="text-[11px] text-muted-foreground">Total Stock</p>
                <p className="text-base font-bold font-mono">{totalStockUnits.toLocaleString()}</p>
              </div>
              <div className="p-3 border rounded-lg bg-card space-y-1">
                <p className="text-[11px] text-muted-foreground">Low Stock</p>
                <p className="text-base font-bold font-mono text-red-600 dark:text-red-400">{lowStockCount}</p>
              </div>
              <div className="p-3 border rounded-lg bg-card space-y-1">
                <p className="text-[11px] text-muted-foreground">Expiring Soon</p>
                <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">{expiringSoonCount}</p>
              </div>
            </div>

            {/* Inventory by Category */}
            <div className="space-y-2">
              <p className="text-xs font-semibold">Stock Distribution by Category</p>
              <div className="space-y-2">
                {categoryBreakdown.slice(0, 4).map((cat) => (
                  <div key={cat.category} className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{cat.category} ({cat.count} SKUs)</span>
                      <span className="font-mono font-medium text-foreground">{cat.units.toLocaleString()} units</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min((cat.units / Math.max(totalStockUnits, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Quick Actions & Recent Audit Activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Quick Actions */}
        <Card variant="flat" className="lg:col-span-4 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Admin Quick Actions</CardTitle>
            <CardDescription className="text-xs">Direct entry points to primary management tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5">
            {hasPermission("products:create") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/products" })}>
                <Plus className="size-4 text-primary" /> Add Product
              </Button>
            )}
            {hasPermission("staff:create") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/users" })}>
                <Users className="size-4 text-primary" /> Add Staff
              </Button>
            )}
            {hasPermission("branches:create") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/branches" })}>
                <Building2 className="size-4 text-primary" /> Create Branch
              </Button>
            )}
            {hasPermission("inventory:view") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/inventory" })}>
                <Package className="size-4 text-primary" /> Supply Branch
              </Button>
            )}
            {hasPermission("inventory:view") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/inventory" })}>
                <Boxes className="size-4 text-primary" /> Create Transfer
              </Button>
            )}
            {hasPermission("reports:view") && (
              <Button variant="outline" size="sm" className="h-10 text-xs justify-start gap-2" onClick={() => navigate({ to: "/analytics" })}>
                <TrendingUp className="size-4 text-primary" /> View Reports
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit Activity */}
        <Card variant="flat" className="lg:col-span-8 border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Recent Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">Immutable system events logged across all operations.</CardDescription>
            </div>
            {hasPermission("audit_logs:view") && (
              <Link to="/audit-logs" className="text-xs text-primary font-medium hover:underline flex items-center">
                View Full Logs <ExternalLink className="size-3 ml-1" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No recent audit activities logged.
              </div>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-card border hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{act.userName || "System"}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono py-0">
                        {String(act.module || act.entity || "SYSTEM")}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {String(act.description || `${act.action} on ${act.entity}`)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground">{formatSafe(act.timestamp, "HH:mm:ss")}</span>
                    {act.branchId && <p className="text-[9px] font-mono text-muted-foreground">Branch: {act.branchId}</p>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
