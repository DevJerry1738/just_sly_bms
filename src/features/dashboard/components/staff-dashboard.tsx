import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { startOfDay, endOfDay } from "date-fns";
import { formatSafe } from "@/lib/format-date";
import {
  MonitorPlay,
  ShoppingCart,
  Boxes,
  Package,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  db,
  type SalesSchema,
  type SaleItemSchema,
  type NotificationsSchema,
  type InventoryTransferSchema,
  type InventoryBatchSchema,
} from "@/database/schema";
import { notificationRepository } from "@/repositories/notification.repository";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardsSkeleton } from "@/components/common/skeletons";
import { ReceiptView } from "@/features/pos/components/receipt-view";

export function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const { hasPermission } = useAuthorization();
  const { status } = useNetworkStatus();
  const isOnline = status === "online";

  const [loading, setLoading] = useState(true);

  // Branch Scoped Metrics
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [productsSoldUnits, setProductsSoldUnits] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingSuppliesCount, setPendingSuppliesCount] = useState(0);
  const [pendingTransfersCount, setPendingTransfersCount] = useState(0);

  // Lists Data
  const [incomingSupplies, setIncomingSupplies] = useState<InventoryTransferSchema[]>([]);
  const [branchTransfers, setBranchTransfers] = useState<InventoryTransferSchema[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; sku: string; qty: number; threshold: number }[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<InventoryBatchSchema[]>([]);
  const [recentSales, setRecentSales] = useState<SalesSchema[]>([]);
  const [staffNotifications, setStaffNotifications] = useState<NotificationsSchema[]>([]);

  // Receipt Modal State for Reprint
  const [selectedSale, setSelectedSale] = useState<SalesSchema | null>(null);
  const [selectedSaleItems, setSelectedSaleItems] = useState<SaleItemSchema[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const firstName = user?.email?.split("@")[0] ?? "Staff Member";
  const branchName = activeBranch?.name ?? "No Branch Assigned";

  const loadStaffDashboard = useCallback(async () => {
    if (!activeBranch) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const todayStart = startOfDay(now).getTime();
      const todayEnd = endOfDay(now).getTime();
      const branchId = activeBranch.id;

      // 1. Fetch Sales for Active Branch ONLY
      const allSales = await db.sales.toArray();
      const branchSales = allSales.filter((s) => s.branchId === branchId);
      const todaySales = branchSales.filter((s) => s.createdAt >= todayStart && s.createdAt <= todayEnd && s.status === "completed");

      const revTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
      setTodaySalesTotal(revTotal);
      setTodaySalesCount(todaySales.length);

      // Today's units sold
      const allSaleItems = await db.sale_items.toArray();
      const todaySaleIds = new Set(todaySales.map((s) => s.id));
      const unitsSold = allSaleItems.filter((item) => todaySaleIds.has(item.saleId)).reduce((sum, item) => sum + item.quantity, 0);
      setProductsSoldUnits(unitsSold);

      // Recent 5 sales for branch
      setRecentSales(branchSales.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));

      // 2. Fetch Active Branch Inventory & Low Stock (NO cost prices exposed)
      const allBalances = await db.inventory_balances.toArray();
      const allProducts = await db.products.toArray();
      const branchBalances = allBalances.filter((b) => b.branchId === branchId);

      const lowStockList: { id: string; name: string; sku: string; qty: number; threshold: number }[] = [];
      branchBalances.forEach((b) => {
        const prod = allProducts.find((p) => p.id === b.productId);
        const threshold = prod?.lowStockThreshold ?? 5;
        if (b.quantityOnHand <= threshold && prod) {
          lowStockList.push({
            id: prod.id,
            name: prod.name,
            sku: prod.sku || prod.code,
            qty: b.quantityOnHand,
            threshold,
          });
        }
      });
      setLowStockCount(lowStockList.length);
      setLowStockProducts(lowStockList.slice(0, 5));

      // 3. Expiry Warning (Within 30 Days)
      const allBatches = await db.inventory_batches.toArray();
      const branchBatches = allBatches.filter((b) => b.branchId === branchId);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const expiring = branchBatches.filter((b) => {
        if (!b.expiryDate) return false;
        const expiryTime = new Date(b.expiryDate).getTime();
        return expiryTime - nowMs <= thirtyDaysMs && expiryTime > nowMs;
      });
      setExpiringBatches(expiring.slice(0, 5));

      // 4. Branch Transfers & Incoming HQ Supplies
      const allTransfers = await db.inventory_transfers.toArray();
      const branchTrans = allTransfers.filter((t) => t.sourceBranchId === branchId || t.destinationBranchId === branchId);

      const supplies = branchTrans.filter((t) => t.transferType === "hq_supply" && t.destinationBranchId === branchId);
      setIncomingSupplies(supplies.filter((s) => s.status !== "received" && s.status !== "cancelled"));
      setPendingSuppliesCount(supplies.filter((s) => s.status === "in_transit" || s.status === "dispatched").length);

      const interBranch = branchTrans.filter((t) => t.transferType === "branch_transfer");
      setBranchTransfers(interBranch.slice(0, 5));
      setPendingTransfersCount(interBranch.filter((t) => t.status === "pending_dispatch" || t.status === "in_transit").length);

      // 5. User Branch Notifications
      const notifs = await notificationRepository.getForUser(user?.id || "", 5, branchId);
      setStaffNotifications(notifs);
    } catch (err) {
      console.error("[StaffDashboard] Failed to load staff data:", err);
      toast.error("Failed to refresh branch operational dashboard");
    } finally {
      setLoading(false);
    }
  }, [activeBranch, user?.id]);

  useEffect(() => {
    loadStaffDashboard();
  }, [loadStaffDashboard]);

  const handleOpenReprint = async (sale: SalesSchema) => {
    try {
      const items = await db.sale_items.where("saleId").equals(sale.id).toArray();
      setSelectedSale(sale);
      setSelectedSaleItems(items);
      setReceiptOpen(true);
    } catch (err) {
      console.error("[StaffDashboard] Failed to fetch sale items:", err);
      toast.error("Unable to load receipt details");
    }
  };

  if (!activeBranch && !loading) {
    return (
      <div className="p-12 text-center space-y-4 animate-fade-in">
        <ShieldAlert className="size-12 mx-auto text-amber-500" />
        <h2 className="text-xl font-bold">No Active Branch Assigned</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your account is not assigned to a specific branch location. Please contact your system administrator to assign a branch.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Branch Operational Dashboard" description="Loading branch sales and inventory feeds..." />
        <CardsSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Toolbar with Active Branch Prominently Displayed */}
      <PageHeader
        title={`Good morning, ${firstName}`}
        description={`Active Location: ${branchName}`}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold border-primary/40 bg-primary/5 text-primary gap-1">
              <Building2 className="size-3.5" /> {branchName}
            </Badge>
            <Badge variant={isOnline ? "outline" : "secondary"} className="text-xs px-2 py-0.5 font-mono">
              {isOnline ? "🟢 Online" : "🟠 Offline (Cached)"}
            </Badge>
          </div>
        }
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={loadStaffDashboard}>
            <RefreshCw className="size-3.5" /> Refresh Data
          </Button>
        }
      />

      {/* Staff KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Today's Sales"
          value={`₦${todaySalesTotal.toLocaleString()}`}
          hint={`${todaySalesCount} completed transactions`}
          icon={ShoppingCart}
        />
        <StatCard
          label="Products Sold"
          value={productsSoldUnits.toString()}
          hint="Units sold today"
          icon={Package}
        />
        <StatCard
          label="Low Stock Alert"
          value={lowStockCount.toString()}
          hint="Branch items low"
          icon={AlertTriangle}
        />
        <StatCard
          label="Pending Supplies"
          value={pendingSuppliesCount.toString()}
          hint="Incoming from HQ"
          icon={Truck}
        />
        <StatCard
          label="Pending Transfers"
          value={pendingTransfersCount.toString()}
          hint="Awaiting action"
          icon={Boxes}
        />
      </div>

      {/* Primary Action Callout: START NEW SALE (POS) */}
      <Card className="border-2 border-primary/30 bg-primary/5 shadow-xs">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold flex items-center justify-center md:justify-start gap-2">
              <MonitorPlay className="size-5 text-primary" /> Start a New Retail Sale
            </h3>
            <p className="text-xs text-muted-foreground">
              Launch the point-of-sale terminal to scan items, process barcodes, and issue thermal receipts.
            </p>
          </div>
          {hasPermission("sales:create") && (
            <Button size="lg" className="px-8 font-bold text-sm shadow-md gap-2" onClick={() => navigate({ to: "/pos" })}>
              <MonitorPlay className="size-5" /> Open POS Terminal
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Incoming Supplies & Branch Transfers */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Incoming HQ Supplies */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="size-4 text-primary" /> Incoming Stock Supplies from HQ
            </CardTitle>
            <CardDescription className="text-xs">Review and confirm stock shipments dispatched to {branchName}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingSupplies.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No incoming supplies pending confirmation.
              </div>
            ) : (
              incomingSupplies.map((s) => (
                <div key={s.id} className="p-3 bg-card border rounded-lg flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">Supply #{s.transferNumber}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sent: {formatSafe(s.createdAt, "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => navigate({ to: "/inventory" })}>
                    Review & Confirm →
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Branch Transfers */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Boxes className="size-4 text-primary" /> Inter-Branch Transfers
            </CardTitle>
            <CardDescription className="text-xs">Active stock movements between {branchName} and other locations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {branchTransfers.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No active branch transfers recorded.
              </div>
            ) : (
              branchTransfers.map((t) => (
                <div key={t.id} className="p-3 bg-card border rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{t.sourceBranchId === activeBranch?.id ? `Outgoing → ${t.destinationBranchId}` : `Incoming ← ${t.sourceBranchId}`}</span>
                      <Badge variant="outline" className="text-[9px] capitalize">
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">Transfer #{t.transferNumber}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate({ to: "/inventory" })}>
                    Review
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock & Expiry Warnings */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Low Stock Table (NO Cost Prices Exposed) */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Branch Low Stock Items</CardTitle>
              <CardDescription className="text-xs">Products approaching reorder point at {branchName}.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate({ to: "/inventory" })}>
              View Inventory →
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No products currently below low stock threshold.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs">Product Name</TableHead>
                      <TableHead className="text-xs text-right">StockOnHand</TableHead>
                      <TableHead className="text-xs text-right">Threshold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((p) => (
                      <TableRow key={p.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-semibold">
                          <div>{p.name}</div>
                          <span className="text-[10px] text-muted-foreground font-mono">{p.sku}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600 dark:text-red-400">{p.qty}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{p.threshold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card variant="flat" className="lg:col-span-6 border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Expiring Batches (30 Days)</CardTitle>
              <CardDescription className="text-xs">Batches requiring prompt discount or disposal action.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate({ to: "/inventory" })}>
              View Batches →
            </Button>
          </CardHeader>
          <CardContent>
            {expiringBatches.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No inventory batches expiring within the next 30 days.
              </div>
            ) : (
              <div className="space-y-2">
                {expiringBatches.map((b) => (
                  <div key={b.id} className="p-2.5 bg-card border rounded-lg flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold">Batch #{b.batchNumber}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">Product ID: {b.productId}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        Expires: {formatSafe(b.expiryDate, "dd MMM yyyy", "N/A")}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">{b.quantityOnHand} units remaining</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales History & Notifications */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Branch Sales */}
        <Card variant="flat" className="lg:col-span-8 border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Recent Branch POS Sales</CardTitle>
              <CardDescription className="text-xs">Latest transactions processed at {branchName}.</CardDescription>
            </div>
            <Link to="/sales" className="text-xs text-primary font-medium hover:underline flex items-center">
              Sales History <ChevronRight className="size-3 ml-0.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No sales recorded for this branch today.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs">Receipt #</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Cashier</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((s) => (
                      <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-semibold">{s.saleNumber}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{formatSafe(s.createdAt, "HH:mm:ss")}</TableCell>
                        <TableCell>{s.createdByName || "Cashier"}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₦{s.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleOpenReprint(s)}>
                            <Printer className="size-3" /> Reprint
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Notifications */}
        <Card variant="flat" className="lg:col-span-4 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" /> Operational Alerts
            </CardTitle>
            <CardDescription className="text-xs">Real-time alerts for {branchName}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {staffNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No active notifications.
              </div>
            ) : (
              staffNotifications.map((n) => (
                <div key={n.id} className="p-2.5 bg-card border rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="truncate">{String((n as Record<string, unknown>).title || "Notification")}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{formatSafe(n.createdAt, "HH:mm")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{String((n as Record<string, unknown>).message || "")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt Reprint Modal */}
      {selectedSale && (
        <ReceiptView
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          sale={selectedSale}
          items={selectedSaleItems}
          branch={activeBranch}
          isReprint={true}
        />
      )}
    </div>
  );
}
