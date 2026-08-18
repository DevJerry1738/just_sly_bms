import { useState } from "react";
import { reportService } from "@/services/reports/report.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, TrendingUp, Package, Users, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const exportSalesSummary = async () => {
    setDownloading("sales");
    try {
      const sales = await reportService.getSalesAnalytics();
      const headers = ["Metric", "Value"];
      const rows = [
        ["Total Revenue (NGN)", sales.totalRevenue],
        ["POS Revenue (NGN)", sales.posRevenue],
        ["Wholesale Revenue (NGN)", sales.wholesaleRevenue],
        ["Total Orders", sales.totalOrders],
        ["POS Orders Count", sales.posOrdersCount],
        ["Wholesale Orders Count", sales.wholesaleOrdersCount],
        ["Average Order Value (NGN)", Math.round(sales.averageOrderValue)],
      ];
      reportService.exportToCSV("sales_summary_report.csv", headers, rows);
      toast.success("Sales summary exported successfully!");
    } catch (err) {
      toast.error("Failed to export sales report.");
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
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      <div className="border-b pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" /> Export Center & Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate structured CSV data reports across business channels.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sales Report Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg w-fit mb-2">
              <TrendingUp className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Sales Summary Report</CardTitle>
            <CardDescription>
              Detailed breakdown of POS sales vs. Wholesale revenue, total orders, and average order values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              onClick={exportSalesSummary}
              disabled={downloading === "sales"}
            >
              <Download className="h-4 w-4" />
              {downloading === "sales" ? "Generating CSV..." : "Export Sales CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Inventory Report Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="p-3 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-lg w-fit mb-2">
              <Package className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Inventory Valuation</CardTitle>
            <CardDescription>
              Stock balance counts, total valuation at cost price, and category distribution.
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
              {downloading === "inventory" ? "Generating CSV..." : "Export Inventory CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Wholesale Report Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg w-fit mb-2">
              <Users className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Wholesale Client Performance</CardTitle>
            <CardDescription>
              Wholesale accounts leaderboard, order fulfillment rates, and revenue volume per client.
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
              {downloading === "wholesale" ? "Generating CSV..." : "Export Wholesale CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
