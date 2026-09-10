import { useState, useEffect, useCallback, useMemo } from "react";
import {
  reportService,
  type SalesAnalytics,
  type InventoryAnalytics,
  type WholesaleAnalytics,
  type TimeSeriesPoint,
} from "@/services/reports/report.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Building2,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { useBranch } from "@/providers/branch-provider";

export function AnalyticsDashboardPage() {
  const { activeBranch, branches, setActiveBranchId } = useBranch();
  const [timeHorizon, setTimeHorizon] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartVisualType, setChartVisualType] = useState<"area" | "bar">("area");
  const [selectedChannelMetric, setSelectedChannelMetric] = useState<"revenue" | "profit" | "orders">("revenue");

  const [sales, setSales] = useState<SalesAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [wholesale, setWholesale] = useState<WholesaleAnalytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const startDate = now - timeHorizon * 24 * 60 * 60 * 1000;
      const branchId = activeBranch?.id;

      const [salesData, inventoryData, wholesaleData] = await Promise.all([
        reportService.getSalesAnalytics({ startDate, branchId, daysCount: timeHorizon }),
        reportService.getInventoryAnalytics(),
        reportService.getWholesaleAnalytics({ startDate }),
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
  }, [timeHorizon, activeBranch?.id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportTopProducts = () => {
    if (!sales || sales.topProducts.length === 0) {
      toast.error("No product profitability data to export.");
      return;
    }
    const headers = ["Product Name", "SKU", "Units Sold", "Revenue (NGN)", "Cost (NGN)", "Gross Profit (NGN)", "Margin (%)"];
    const rows = sales.topProducts.map((p) => [
      p.productName,
      p.sku,
      p.quantitySold,
      p.revenue,
      p.cost,
      p.profit,
      `${p.margin.toFixed(1)}%`,
    ]);
    reportService.exportToCSV(`product_profitability_${timeHorizon}d.csv`, headers, rows);
    toast.success("Product profitability report exported!");
  };

  const handleExportTimeSeries = () => {
    if (!sales || sales.timeSeries.length === 0) {
      toast.error("No time series data to export.");
      return;
    }
    const headers = [
      "Date",
      "Retail Revenue (NGN)",
      "Wholesale Revenue (NGN)",
      "Total Revenue (NGN)",
      "COGS (NGN)",
      "Gross Profit (NGN)",
      "Gross Margin (%)",
      "Total Orders",
    ];
    const rows = sales.timeSeries.map((t) => [
      t.date,
      t.retailRevenue,
      t.wholesaleRevenue,
      t.totalRevenue,
      t.cogs,
      t.grossProfit,
      `${t.grossMargin.toFixed(1)}%`,
      t.totalOrders,
    ]);
    reportService.exportToCSV(`sales_trajectory_${timeHorizon}d.csv`, headers, rows);
    toast.success("Daily trajectory data exported!");
  };

  const handleExportTopCustomers = () => {
    if (!wholesale || wholesale.topCustomers.length === 0) {
      toast.error("No wholesale accounts data to export.");
      return;
    }
    const headers = ["Customer Name", "Total Orders", "Total Spent (NGN)"];
    const rows = wholesale.topCustomers.map((c) => [c.customerName, c.totalOrders, c.totalSpent]);
    reportService.exportToCSV(`top_wholesale_customers_${timeHorizon}d.csv`, headers, rows);
    toast.success("Top wholesale accounts exported!");
  };

  const handleExportInventory = () => {
    if (!inventory || inventory.categoryBreakdown.length === 0) {
      toast.error("No inventory data to export.");
      return;
    }
    const headers = ["Category", "Product Count", "Total Valuation Cost (NGN)"];
    const rows = inventory.categoryBreakdown.map((c) => [c.category, c.count, c.totalValue]);
    reportService.exportToCSV("inventory_valuation_breakdown.csv", headers, rows);
    toast.success("Inventory valuation breakdown exported!");
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Top Header & Global Filter Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <TrendingUp className="size-7 text-primary" /> Reports & Analytics
            </h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Executive View
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Real-time revenue velocity, COGS profit margins, wholesale accounts, and multi-branch benchmarking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto">
          {/* Branch Context Selector */}
          <Select
            value={activeBranch?.id || "all"}
            onValueChange={(val) => setActiveBranchId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[170px] h-9 text-xs bg-background">
              <Building2 className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏢 All Branches (Aggregated)</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Horizon Pills */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border text-xs h-9">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTimeHorizon(days)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  timeHorizon === days
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading} className="gap-2 h-9 text-xs">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Ribbon (Revenue, Profit, Margin, Volume, Inventory) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Revenue */}
        <Card className="shadow-xs border bg-card/60 backdrop-blur-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gross Revenue ({timeHorizon}D)
            </CardTitle>
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              ₦{(sales?.totalRevenue || 0).toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>POS: ₦{(sales?.posRevenue || 0).toLocaleString()}</span>
              <span>WS: ₦{(sales?.wholesaleRevenue || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Gross Profit & Margin % */}
        <Card className="shadow-xs border bg-card/60 backdrop-blur-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gross Profit & Margin
            </CardTitle>
            <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Percent className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 flex items-baseline gap-2">
              <span>₦{(sales?.grossProfit || 0).toLocaleString()}</span>
              <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200">
                {(sales?.grossMarginPercent || 0).toFixed(1)}% Margin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              COGS: ₦{(sales?.totalCost || 0).toLocaleString()} (FIFO Cost)
            </p>
          </CardContent>
        </Card>

        {/* Transaction Volume & AOV */}
        <Card className="shadow-xs border bg-card/60 backdrop-blur-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Orders & Avg Value
            </CardTitle>
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <ShoppingCart className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {sales?.totalOrders || 0} Orders
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              AOV: ₦{Math.round(sales?.averageOrderValue || 0).toLocaleString()} (POS: ₦{Math.round(sales?.posAverageOrderValue || 0).toLocaleString()})
            </p>
          </CardContent>
        </Card>

        {/* Stock Health & Valuation */}
        <Card className="shadow-xs border bg-card/60 backdrop-blur-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Stock Assets & Health
            </CardTitle>
            <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Package className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              ₦{(inventory?.totalValuationCost || 0).toLocaleString()}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pt-1">
              {inventory?.lowStockItemsCount || 0} Low Stock | {inventory?.expiringSoonBatchesCount || 0} Expiring Soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Workspace Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-9">
          <TabsTrigger value="overview" className="text-xs">Revenue & Profit</TabsTrigger>
          <TabsTrigger value="products" className="text-xs">Product Profitability</TabsTrigger>
          <TabsTrigger value="wholesale" className="text-xs">Wholesale & Channels</TabsTrigger>
        </TabsList>

        {/* TAB 1: Revenue & Profitability Trajectory */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b bg-muted/20">
              <div>
                <CardTitle className="text-base font-semibold">Revenue & Gross Profit Trajectory</CardTitle>
                <CardDescription className="text-xs">
                  Daily financial performance comparison across retail POS and wholesale channels.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedChannelMetric("revenue")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedChannelMetric === "revenue"
                        ? "bg-background text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Revenue
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChannelMetric("profit")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedChannelMetric === "profit"
                        ? "bg-background text-purple-600 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Gross Profit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChannelMetric("orders")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedChannelMetric === "orders"
                        ? "bg-background text-blue-600 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Order Volume
                  </button>
                </div>

                <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => setChartVisualType("area")}
                    className={`p-1.5 rounded-md ${chartVisualType === "area" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"}`}
                    title="Area Curve"
                  >
                    <TrendingUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartVisualType("bar")}
                    className={`p-1.5 rounded-md ${chartVisualType === "bar" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"}`}
                    title="Column Bar"
                  >
                    <BarChart3 className="size-3.5" />
                  </button>
                </div>

                <Button variant="outline" size="sm" onClick={handleExportTimeSeries} className="gap-1.5 text-xs h-8">
                  <Download className="size-3" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-72 w-full">
                {!sales?.timeSeries || sales.timeSeries.length === 0 || sales.timeSeries.every((t) => t.totalRevenue === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 border border-dashed rounded-xl bg-muted/10">
                    <TrendingUp className="size-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium">No sales transactions found in this {timeHorizon}-day range.</p>
                  </div>
                ) : chartVisualType === "area" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sales.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaRetail" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="areaWholesale" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="areaProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        className="text-muted-foreground font-mono"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={(val) => (val >= 1000 ? `₦${(val / 1000).toFixed(0)}k` : `₦${val}`)}
                        className="text-muted-foreground font-mono"
                        width={65}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as TimeSeriesPoint;
                            return (
                              <div className="bg-popover/95 backdrop-blur-sm border shadow-lg rounded-lg p-2.5 text-xs space-y-1.5 min-w-[180px]">
                                <div className="font-semibold text-foreground border-b pb-1">
                                  {data.date} ({data.label})
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                                    <span>Retail POS:</span>
                                    <span className="font-mono font-semibold">₦{data.retailRevenue.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400">
                                    <span>Wholesale:</span>
                                    <span className="font-mono font-semibold">₦{data.wholesaleRevenue.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-purple-600 dark:text-purple-400">
                                    <span>Gross Profit:</span>
                                    <span className="font-mono font-semibold">₦{data.grossProfit.toLocaleString()} ({data.grossMargin.toFixed(1)}%)</span>
                                  </div>
                                  <div className="border-t pt-1 flex items-center justify-between gap-3 font-semibold text-foreground">
                                    <span>Total Revenue:</span>
                                    <span className="font-mono text-primary">₦{data.totalRevenue.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {selectedChannelMetric === "revenue" && (
                        <>
                          <Area type="monotone" dataKey="retailRevenue" stroke="#10b981" strokeWidth={2} fill="url(#areaRetail)" name="Retail POS" />
                          <Area type="monotone" dataKey="wholesaleRevenue" stroke="#3b82f6" strokeWidth={2} fill="url(#areaWholesale)" name="Wholesale" />
                        </>
                      )}
                      {selectedChannelMetric === "profit" && (
                        <Area type="monotone" dataKey="grossProfit" stroke="#a855f7" strokeWidth={2.5} fill="url(#areaProfit)" name="Gross Profit" />
                      )}
                      {selectedChannelMetric === "orders" && (
                        <>
                          <Area type="monotone" dataKey="retailOrders" stroke="#10b981" strokeWidth={2} fill="url(#areaRetail)" name="POS Orders" />
                          <Area type="monotone" dataKey="wholesaleOrders" stroke="#3b82f6" strokeWidth={2} fill="url(#areaWholesale)" name="Wholesale Orders" />
                        </>
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sales.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground font-mono" />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={(val) => (selectedChannelMetric === "orders" ? `${val}` : val >= 1000 ? `₦${(val / 1000).toFixed(0)}k` : `₦${val}`)}
                        className="text-muted-foreground font-mono"
                        width={65}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as TimeSeriesPoint;
                            return (
                              <div className="bg-popover/95 backdrop-blur-sm border shadow-lg rounded-lg p-2.5 text-xs space-y-1.5 min-w-[180px]">
                                <div className="font-semibold text-foreground border-b pb-1">
                                  {data.date} ({data.label})
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                                    <span>Retail:</span>
                                    <span className="font-mono font-semibold">₦{data.retailRevenue.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400">
                                    <span>Wholesale:</span>
                                    <span className="font-mono font-semibold">₦{data.wholesaleRevenue.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-purple-600 dark:text-purple-400">
                                    <span>Profit:</span>
                                    <span className="font-mono font-semibold">₦{data.grossProfit.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {selectedChannelMetric === "profit" ? (
                        <Bar dataKey="grossProfit" fill="#a855f7" radius={[4, 4, 0, 0]} name="Gross Profit" />
                      ) : selectedChannelMetric === "orders" ? (
                        <>
                          <Bar dataKey="retailOrders" fill="#10b981" radius={[4, 4, 0, 0]} name="Retail Orders" />
                          <Bar dataKey="wholesaleOrders" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Wholesale Orders" />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="retailRevenue" fill="#10b981" radius={[0, 0, 0, 0]} stackId="stack" name="Retail POS" />
                          <Bar dataKey="wholesaleRevenue" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="stack" name="Wholesale" />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Bottom Channel Velocity Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t mt-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Retail POS Channel</div>
                  <div className="text-lg font-bold text-emerald-950 dark:text-emerald-100 mt-1">
                    ₦{(sales?.posRevenue || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    {sales?.posOrdersCount || 0} POS receipts issued
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-lg">
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">Wholesale Desk Channel</div>
                  <div className="text-lg font-bold text-blue-950 dark:text-blue-100 mt-1">
                    ₦{(sales?.wholesaleRevenue || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-0.5">
                    {sales?.wholesaleOrdersCount || 0} wholesale orders confirmed
                  </div>
                </div>

                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 rounded-lg">
                  <div className="text-xs font-semibold text-purple-800 dark:text-purple-300">Gross Margin Health</div>
                  <div className="text-lg font-bold text-purple-950 dark:text-purple-100 mt-1">
                    {(sales?.grossMarginPercent || 0).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-purple-700/80 dark:text-purple-400 mt-0.5">
                    ₦{(sales?.grossProfit || 0).toLocaleString()} net margin
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Product Profitability Leaderboard */}
        <TabsContent value="products" className="space-y-6">
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle className="text-base font-semibold">Product Profitability Leaderboard</CardTitle>
                <CardDescription className="text-xs">
                  Ranking top items by revenue volume, unit cost price, and gross margin profit contribution.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportTopProducts} className="gap-1.5 text-xs">
                <Download className="size-3.5" /> Export Products CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sales?.topProducts && sales.topProducts.length > 0 ? (
                <div className="relative overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Revenue (NGN)</TableHead>
                        <TableHead className="text-right">COGS (NGN)</TableHead>
                        <TableHead className="text-right">Gross Profit (NGN)</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.topProducts.map((p, idx) => (
                        <TableRow key={p.productId} className="hover:bg-muted/30">
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-foreground">{p.productName}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                          <TableCell className="text-right font-mono">{p.quantitySold.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-foreground">
                            ₦{p.revenue.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ₦{p.cost.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            ₦{p.profit.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={`text-xs font-mono ${
                                p.margin >= 30
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : p.margin >= 15
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                              }`}
                            >
                              {p.margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No sales recorded for the selected time horizon.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Wholesale & Channel Accounts */}
        <TabsContent value="wholesale" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wholesale Order Status Pipeline */}
            <Card className="lg:col-span-1 shadow-xs border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold">Wholesale Fulfillment Funnel</CardTitle>
                <CardDescription className="text-xs">Order status transition breakdown</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs font-medium flex items-center gap-2">
                    <Clock className="size-3.5 text-amber-500" /> Pending Payment
                  </span>
                  <Badge variant="secondary" className="font-mono">{wholesale?.pendingPaymentCount || 0}</Badge>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs font-medium flex items-center gap-2">
                    <CheckCircle className="size-3.5 text-blue-500" /> Confirmed / In Production
                  </span>
                  <Badge variant="secondary" className="font-mono">{wholesale?.confirmedCount || 0}</Badge>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs font-medium flex items-center gap-2">
                    <CheckCircle className="size-3.5 text-emerald-500" /> Fulfilled & Delivered
                  </span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-mono">
                    {wholesale?.fulfilledCount || 0}
                  </Badge>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
                  <span className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="size-3.5 text-red-500" /> Cancelled / Rejected
                  </span>
                  <Badge variant="outline" className="font-mono text-muted-foreground">{wholesale?.cancelledCount || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Top Wholesale Accounts Table */}
            <Card className="lg:col-span-2 shadow-xs border">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                <div>
                  <CardTitle className="text-base font-semibold">Top Wholesale Customer Accounts</CardTitle>
                  <CardDescription className="text-xs">High-volume business accounts by total expenditure</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportTopCustomers} className="gap-1.5 text-xs">
                  <Download className="size-3.5" /> CSV Export
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {wholesale?.topCustomers && wholesale.topCustomers.length > 0 ? (
                  <div className="relative overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Customer / Business</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Total Spent (NGN)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wholesale.topCustomers.map((c, i) => (
                          <TableRow key={c.customerId} className="hover:bg-muted/30">
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium flex items-center gap-2">
                              <Users className="size-3.5 text-muted-foreground" />
                              {c.customerName}
                            </TableCell>
                            <TableCell className="text-right font-mono">{c.totalOrders}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                              ₦{c.totalSpent.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No wholesale activity found for this timeframe.
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
