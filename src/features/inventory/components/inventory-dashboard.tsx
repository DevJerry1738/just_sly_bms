import React, { useState, useEffect } from "react";
import {
  Boxes,
  DollarSign,
  AlertTriangle,
  XCircle,
  Clock,
  PackageX,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { useAuthorization } from "@/hooks/use-authorization";

interface DashboardMetrics {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
}

export function InventoryDashboard({ branchId }: { branchId?: string }) {
  const { hasPermission } = useAuthorization();
  const canViewCost = hasPermission("inventory:view_cost") || hasPermission("products:view_cost");

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProducts: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      setIsLoading(true);
      try {
        const [summary, expirySummary] = await Promise.all([
          inventoryBalanceRepository.getSummary(branchId),
          inventoryBatchRepository.getExpirySummary(branchId),
        ]);

        setMetrics({
          totalProducts: summary.totalProducts,
          totalValue: summary.totalValue,
          lowStockCount: summary.lowStockCount,
          outOfStockCount: summary.outOfStockCount,
          expiringSoonCount: expirySummary.expiring30d,
          expiredCount: expirySummary.expired,
        });
      } catch (err) {
        console.error("Failed to load inventory dashboard metrics", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [branchId]);

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Products */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Products in Stock
            </CardTitle>
            <Boxes className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : metrics.totalProducts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active products with recorded balances</p>
          </CardContent>
        </Card>

        {/* Total Inventory Value */}
        {canViewCost && (
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Inventory Value
              </CardTitle>
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {isLoading ? "..." : `₦${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">FIFO cost valuation of current stock</p>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Items */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isLoading ? "..." : metrics.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Below minimum threshold</p>
          </CardContent>
        </Card>

        {/* Out of Stock Items */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Out of Stock Items
            </CardTitle>
            <XCircle className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {isLoading ? "..." : metrics.outOfStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Zero quantity on hand</p>
          </CardContent>
        </Card>

        {/* Expiring Soon (30d) */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Expiring Soon (30 Days)
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isLoading ? "..." : metrics.expiringSoonCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Batches expiring within 30 days</p>
          </CardContent>
        </Card>

        {/* Expired Stock */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Expired Batches
            </CardTitle>
            <PackageX className="w-4 h-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {isLoading ? "..." : metrics.expiredCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Past expiry date requiring quarantine</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border border-dashed flex flex-col justify-center items-center h-48 text-center bg-muted/20">
          <TrendingUp className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
          <h4 className="text-sm font-semibold text-muted-foreground">Stock Movement Trends</h4>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            Data aggregation engine active. Visualization charts ready for Sales &amp; Purchasing modules in future sprints.
          </p>
        </Card>

        <Card className="p-4 border border-dashed flex flex-col justify-center items-center h-48 text-center bg-muted/20">
          <ArrowUpRight className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
          <h4 className="text-sm font-semibold text-muted-foreground">Category Stock Breakdown</h4>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            Real-time balance valuation ready. Graphical breakdown widget ready for reporting module.
          </p>
        </Card>
      </div>
    </div>
  );
}
