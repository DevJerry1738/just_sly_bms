import { useState } from "react";
import { reportService } from "@/services/reports/report.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, TrendingUp, Package, Users, DollarSign, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const exportSalesAndProfitSummary = async () => {
    setDownloading("sales_pnl");
    try {
      const sales = await reportService.getSalesAnalytics();
      const headers = ["Metric", "Value"];
      const rows = [
        ["Total Revenue (NGN)", sales.totalRevenue.toLocaleString()],
        ["Total Cost of Goods Sold - COGS (NGN)", sales.totalCost.toLocaleString()],
        ["Gross Profit (NGN)", sales.grossProfit.toLocaleString()],
        ["Gross Margin (%)", `${sales.grossMarginPercent.toFixed(2)}%`],
        ["POS Retail Revenue (NGN)", sales.posRevenue.toLocaleString()],
        ["Wholesale B2B Revenue (NGN)", sales.wholesaleRevenue.toLocaleString()],
        ["Total Orders / Invoices", sales.totalOrders],
        ["POS Transactions Count", sales.posOrdersCount],
        ["Wholesale Orders Count", sales.wholesaleOrdersCount],
        ["Average Order Value (NGN)", Math.round(sales.averageOrderValue).toLocaleString()],
      ];
      reportService.exportToCSV("sales_and_profitability_pnl.csv", headers, rows);
      toast.success("Sales & Profitability P&L summary exported successfully!");
    } catch (err) {
      toast.error("Failed to export sales & P&L report.");
    } finally {
      setDownloading(null);
    }
  };

  const exportProductProfitability = async () => {
    setDownloading("products_margin");
    try {
      const sales = await reportService.getSalesAnalytics();
      const headers = [
        "Product Name",
        "Units Sold",
        "Total Revenue (NGN)",
        "Total Cost / COGS (NGN)",
        "Gross Profit (NGN)",
        "Gross Margin (%)",
      ];
      const rows = sales.topProducts.map((p) => [
        p.name,
        p.quantity,
        p.revenue,
        p.cost,
        p.profit,
        `${p.marginPercent.toFixed(1)}%`,
      ]);
      reportService.exportToCSV("product_profitability_breakdown.csv", headers, rows);
      toast.success("Product profitability breakdown exported!");
    } catch (err) {
      toast.error("Failed to export product margin report.");
    } finally {
      setDownloading(null);
    }
  };

  const exportInventoryValuation = async () => {
    setDownloading("inventory");
    try {
      const inv = await reportService.getInventoryAnalytics();
      const headers = ["Category", "Product Count", "Total Valuation Cost (NGN)"];
      const rows = inv.categoryBreakdown.map((c) => [c.category, c.count, c.totalValue]);
      reportService.exportToCSV("inventory_valuation_report.csv", headers, rows);
      toast.success("Inventory valuation report exported!");
    } catch (err) {
      toast.error("Failed to export inventory valuation.");
    } finally {
      setDownloading(null);
    }
  };

  const exportWholesaleLeaderboard = async () => {
    setDownloading("wholesale");
    try {
      const ws = await reportService.getWholesaleAnalytics();
      const headers = ["Customer Name", "Total Orders", "Total Spent (NGN)"];
      const rows = ws.topCustomers.map((c) => [c.customerName, c.totalOrders, c.totalSpent]);
      reportService.exportToCSV("wholesale_customer_report.csv", headers, rows);
      toast.success("Wholesale client report exported!");
    } catch (err) {
      toast.error("Failed to export wholesale client report.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="border-b pb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> Export Center & Structured Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate clean, auditable CSV financial and operational reports across retail, wholesale, and inventory operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales & P&L Summary Report Card */}
        <Card className="shadow-sm border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg w-fit">
                <DollarSign className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                P&L / Executive
              </span>
            </div>
            <CardTitle className="text-lg mt-3">Sales & Gross Profit P&L Summary</CardTitle>
            <CardDescription>
              Executive statement covering Total Revenue, COGS, Gross Profit, Gross Margin %, POS vs Wholesale split, and Average Order Value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              onClick={exportSalesAndProfitSummary}
              disabled={downloading === "sales_pnl"}
            >
              <Download className="h-4 w-4" />
              {downloading === "sales_pnl" ? "Generating CSV..." : "Export P&L Summary CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Product Profitability Card */}
        <Card className="shadow-sm border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-lg w-fit">
                <TrendingUp className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Unit Economics
              </span>
            </div>
            <CardTitle className="text-lg mt-3">Product Profitability Breakdown</CardTitle>
            <CardDescription>
              Granular SKU performance including units sold, total revenue, FIFO cost price snapshots, gross margin %, and net profit contributions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={exportProductProfitability}
              disabled={downloading === "products_margin"}
            >
              <Download className="h-4 w-4" />
              {downloading === "products_margin" ? "Generating CSV..." : "Export Product Margin CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Inventory Report Card */}
        <Card className="shadow-sm border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-lg w-fit">
                <Package className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                Valuation
              </span>
            </div>
            <CardTitle className="text-lg mt-3">Inventory Valuation & Categories</CardTitle>
            <CardDescription>
              Current stock balances, holding values calculated at cost price, and stock category distribution matrices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={exportInventoryValuation}
              disabled={downloading === "inventory"}
            >
              <Download className="h-4 w-4" />
              {downloading === "inventory" ? "Generating CSV..." : "Export Inventory Valuation CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Wholesale Report Card */}
        <Card className="shadow-sm border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg w-fit">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                B2B Client Desk
              </span>
            </div>
            <CardTitle className="text-lg mt-3">Wholesale Client Performance</CardTitle>
            <CardDescription>
              Wholesale accounts leaderboard, order fulfillment counts, total revenue volume per corporate client, and debt exposures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={exportWholesaleLeaderboard}
              disabled={downloading === "wholesale"}
            >
              <Download className="h-4 w-4" />
              {downloading === "wholesale" ? "Generating CSV..." : "Export Wholesale Client CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

