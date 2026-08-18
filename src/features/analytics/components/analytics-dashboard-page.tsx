import { useState, useEffect } from "react";
import {
  reportService,
  SalesAnalytics,
  InventoryAnalytics,
  WholesaleAnalytics,
} from "@/services/reports/report.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  AlertTriangle,
  Download,
  Calendar,
  RefreshCw,
  Clock,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

export function AnalyticsDashboardPage() {
  const [timeRange, setTimeRange] = useState<string>("30days");
  const [loading, setLoading] = useState<boolean>(true);

  const [sales, setSales] = useState<SalesAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [wholesale, setWholesale] = useState<WholesaleAnalytics | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      let startDate: number | undefined;

      if (timeRange === "7days") {
        startDate = now - 7 * 24 * 60 * 60 * 1000;
      } else if (timeRange === "30days") {
        startDate = now - 30 * 24 * 60 * 60 * 1000;
      } else if (timeRange === "90days") {
        startDate = now - 90 * 24 * 60 * 60 * 1000;
      }

      const filters = startDate ? { startDate } : undefined;

      const [salesData, inventoryData, wholesaleData] = await Promise.all([
        reportService.getSalesAnalytics(filters),
        reportService.getInventoryAnalytics(),
        reportService.getWholesaleAnalytics(filters),
      ]);

      setSales(salesData);
      setInventory(inventoryData);
      setWholesale(wholesaleData);
    } catch (err) {
      console.error("Failed to load analytics", err);
      toast.error("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const handleExportTopProducts = () => {
    if (!sales || sales.topProducts.length === 0) {
      toast.error("No top products data to export.");
      return;
    }
    const headers = ["Product Name", "Quantity Sold", "Revenue (NGN)"];
    const rows = sales.topProducts.map((p) => [p.productName, p.quantitySold, p.revenue]);
    reportService.exportToCSV(`top_products_${timeRange}.csv`, headers, rows);
    toast.success("Top products exported successfully!");
  };

  const handleExportTopCustomers = () => {
    if (!wholesale || wholesale.topCustomers.length === 0) {
      toast.error("No top customers data to export.");
      return;
    }
    const headers = ["Customer Name", "Total Orders", "Total Spent (NGN)"];
    const rows = wholesale.topCustomers.map((c) => [c.customerName, c.totalOrders, c.totalSpent]);
    reportService.exportToCSV(`top_wholesale_customers_${timeRange}.csv`, headers, rows);
    toast.success("Top customers exported successfully!");
  };

  const handleExportInventory = () => {
    if (!inventory || inventory.categoryBreakdown.length === 0) {
      toast.error("No inventory data to export.");
      return;
    }
    const headers = ["Category", "Product Count", "Total Valuation Cost (NGN)"];
    const rows = inventory.categoryBreakdown.map((c) => [c.category, c.count, c.totalValue]);
    reportService.exportToCSV("inventory_valuation_breakdown.csv", headers, rows);
    toast.success("Inventory valuation report exported successfully!");
  };

  return (
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" /> Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time revenue performance, inventory health, and wholesale metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ₦{(sales?.totalRevenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              POS: ₦{(sales?.posRevenue || 0).toLocaleString()} | Wholesale: ₦
              {(sales?.wholesaleRevenue || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Orders
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {sales?.totalOrders || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg Order: ₦{Math.round(sales?.averageOrderValue || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Inventory Valuation */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Stock Valuation (Cost)
            </CardTitle>
            <Package className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ₦{(inventory?.totalValuationCost || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(inventory?.totalUnits || 0).toLocaleString()} units across {inventory?.totalItems || 0} products
            </p>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Stock Expiries & Low
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{inventory?.lowStockItemsCount || 0}</span>
              <span className="text-xs font-normal text-muted-foreground">Low stock items</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
              {inventory?.expiredBatchesCount || 0} Expired | {inventory?.expiringSoonBatchesCount || 0} Expiring Soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Feature Tabs */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="sales">Sales Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Health</TabsTrigger>
          <TabsTrigger value="wholesale">Wholesale & Clients</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales Overview */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Channel Split */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Channel Split</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">POS Sales</span>
                    <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      {sales?.posOrdersCount || 0} orders
                    </Badge>
                  </div>
                  <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-2">
                    ₦{(sales?.posRevenue || 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Wholesale Desk</span>
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {sales?.wholesaleOrdersCount || 0} orders
                    </Badge>
                  </div>
                  <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                    ₦{(sales?.wholesaleRevenue || 0).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Products Leaderboard */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Performing Products</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportTopProducts} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" /> CSV Export
                </Button>
              </CardHeader>
              <CardContent>
                {sales?.topProducts && sales.topProducts.length > 0 ? (
                  <div className="relative overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3 text-right">Units Sold</th>
                          <th className="px-4 py-3 text-right">Revenue (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sales.topProducts.map((p, i) => (
                          <tr key={p.productId} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                              {p.productName}
                            </td>
                            <td className="px-4 py-3 text-right">{p.quantitySold}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              ₦{p.revenue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No product sales recorded for this period.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Inventory Health */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Expiry Breakdown */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Batch Expiry Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">Expired Batches</span>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                      {inventory?.expiredBatchesCount || 0}
                    </div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500 opacity-80" />
                </div>

                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Expiring (Next 30 Days)</span>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                      {inventory?.expiringSoonBatchesCount || 0}
                    </div>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown Table */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Inventory Valuation by Category</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportInventory} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" /> CSV Export
                </Button>
              </CardHeader>
              <CardContent>
                {inventory?.categoryBreakdown && inventory.categoryBreakdown.length > 0 ? (
                  <div className="relative overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Items Count</th>
                          <th className="px-4 py-3 text-right">Total Valuation (Cost)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {inventory.categoryBreakdown.map((cat) => (
                          <tr key={cat.category} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium">{cat.category}</td>
                            <td className="px-4 py-3 text-right">{cat.count}</td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-600">
                              ₦{cat.totalValue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">No inventory balances found.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Wholesale & Clients */}
        <TabsContent value="wholesale" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wholesale Funnel */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Wholesale Order Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded bg-muted/60">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" /> Pending Payment
                  </span>
                  <Badge variant="secondary">{wholesale?.pendingPaymentCount || 0}</Badge>
                </div>

                <div className="flex justify-between items-center p-3 rounded bg-muted/60">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" /> Confirmed / Processing
                  </span>
                  <Badge variant="secondary">{wholesale?.confirmedCount || 0}</Badge>
                </div>

                <div className="flex justify-between items-center p-3 rounded bg-muted/60">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" /> Delivered / Fulfilled
                  </span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    {wholesale?.fulfilledCount || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Top Wholesale Customers Leaderboard */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Wholesale Accounts</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportTopCustomers} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" /> CSV Export
                </Button>
              </CardHeader>
              <CardContent>
                {wholesale?.topCustomers && wholesale.topCustomers.length > 0 ? (
                  <div className="relative overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-3">Customer / Business</th>
                          <th className="px-4 py-3 text-right">Total Orders</th>
                          <th className="px-4 py-3 text-right">Total Spent (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {wholesale.topCustomers.map((c, i) => (
                          <tr key={c.customerId} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {c.customerName}
                            </td>
                            <td className="px-4 py-3 text-right">{c.totalOrders}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                              ₦{c.totalSpent.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No wholesale customer activity for this period.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
