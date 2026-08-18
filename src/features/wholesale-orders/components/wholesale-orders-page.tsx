import { useState, useEffect, useCallback } from "react";
import {
  Package, Search, CheckCircle, XCircle, Truck, FileText,
  RotateCcw, RefreshCw, Clock, Upload, ChevronDown, Loader2,
  AlertCircle, ClipboardList, DollarSign, BarChart3, Landmark, Building2, CreditCard,
  ExternalLink, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAuth } from "@/providers/auth-provider";
import { wholesaleOrderRepository } from "@/repositories/wholesale-order.repository";
import { wholesaleOrderItemRepository } from "@/repositories/wholesale-order-item.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { paymentReceiptRepository } from "@/repositories/payment-receipt.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { wholesaleOrderService } from "@/services/wholesale/wholesale-order.service";
import type {
  WholesaleOrderSchema,
  WholesaleOrderItemSchema,
  WholesaleOrderStatus,
  CustomerAccountSchema,
  PaymentReceiptSchema,
} from "@/database/schema";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<WholesaleOrderStatus, { label: string; color: string }> = {
  pending_payment:  { label: "Pending Payment",   color: "border-orange-500/30 text-orange-400 bg-orange-500/10" },
  payment_submitted:{ label: "Payment Submitted",  color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  payment_confirmed:{ label: "Payment Confirmed",  color: "border-teal-500/30 text-teal-400 bg-teal-500/10" },
  processing:       { label: "Processing",          color: "border-purple-500/30 text-purple-400 bg-purple-500/10" },
  ready:            { label: "Ready",               color: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10" },
  dispatched:       { label: "Dispatched",          color: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10" },
  delivered:        { label: "Delivered",           color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  cancelled:        { label: "Cancelled",           color: "border-red-500/30 text-red-400 bg-red-500/10" },
};

interface OrderRow {
  order: WholesaleOrderSchema;
  customer?: CustomerAccountSchema;
  items: WholesaleOrderItemSchema[];
  receipt?: PaymentReceiptSchema;
}

export function WholesaleOrdersPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WholesaleOrderStatus>("all");
  const [selectedRow, setSelectedRow] = useState<OrderRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    type: "confirm" | "reject" | "cancel" | "advance";
    nextStatus?: "processing" | "ready" | "dispatched";
  } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Bank Transfer Settings Dialog State
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
    bank_instructions: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  const openBankDialog = async () => {
    try {
      const org = await organizationRepository.getPrimaryOrganization();
      setBankForm({
        bank_name: org.bank_name || "Access Bank Plc",
        bank_account_number: org.bank_account_number || "0123456789",
        bank_account_name: org.bank_account_name || "Just Sly Business Solutions Ltd",
        bank_instructions: org.bank_instructions || "Please use your Order Number as transfer reference/narration.",
      });
      setBankDialogOpen(true);
    } catch {
      toast.error("Failed to load bank settings");
    }
  };

  const handleSaveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.bank_account_number.trim() || !bankForm.bank_account_name.trim()) {
      toast.error("Bank Name, Account Number, and Account Name are required");
      return;
    }
    setSavingBank(true);
    try {
      await organizationRepository.updatePrimaryOrganization(bankForm);
      toast.success("Wholesale bank transfer account details updated!");
      setBankDialogOpen(false);
    } catch {
      toast.error("Failed to save bank transfer account details");
    } finally {
      setSavingBank(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orders = (await wholesaleOrderRepository.getAll().catch(() => [])) || [];
      const customers = (await customerRepository.getAll().catch(() => [])) || [];
      const customerMap = new Map((customers || []).map((c) => [c.id, c]));
      const result: OrderRow[] = await Promise.all(
        orders.map(async (order) => ({
          order,
          customer: customerMap.get(order.customerId),
          items: (await wholesaleOrderItemRepository.getByOrderId(order.id).catch(() => [])) || [],
          receipt: await paymentReceiptRepository.getByOrderId(order.id).catch(() => undefined),
        }))
      );
      setRows(result.sort((a, b) => (b.order?.createdAt || 0) - (a.order?.createdAt || 0)));
    } catch (err) {
      console.error("[WholesaleOrdersPage] Failed to load wholesale orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const adminId = user?.id ?? "system";
  const adminName = user?.fullName ?? profile?.full_name ?? undefined;

  const executeAction = async () => {
    if (!selectedRow || !actionDialog) return;
    setActionLoading(true);
    const { order } = selectedRow;
    try {
      if (actionDialog.type === "confirm") {
        await wholesaleOrderService.confirmPayment(order.id, adminId, actionNote || undefined);
        toast.success("Payment confirmed — HQ stock reserved");
      } else if (actionDialog.type === "reject") {
        if (!actionNote.trim()) { toast.error("Please provide a rejection reason"); return; }
        await wholesaleOrderService.rejectPayment(order.id, adminId, actionNote);
        toast.success("Payment rejected");
      } else if (actionDialog.type === "cancel") {
        if (!actionNote.trim()) { toast.error("Please provide a cancellation reason"); return; }
        await wholesaleOrderService.cancelOrder(order.id, adminId, actionNote);
        toast.success("Order cancelled");
      } else if (actionDialog.type === "advance" && actionDialog.nextStatus) {
        await wholesaleOrderService.advanceStatus(order.id, actionDialog.nextStatus, adminId, adminName, actionNote || undefined);
        toast.success(`Order moved to ${STATUS_CONFIG[actionDialog.nextStatus].label}`);
      }
      setActionDialog(null);
      setActionNote("");
      setDetailOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedRow) return;
    setActionLoading(true);
    try {
      await wholesaleOrderService.markDelivered(selectedRow.order.id, adminId);
      toast.success("Order marked as delivered");
      setDetailOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedRow) return;
    try {
      const invoice = await wholesaleOrderService.generateInvoice(selectedRow.order.id, adminId);
      toast.success(`Invoice ${invoice.invoiceNumber} generated`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const allStatuses: WholesaleOrderStatus[] = [
    "pending_payment", "payment_submitted", "payment_confirmed",
    "processing", "ready", "dispatched", "delivered", "cancelled",
  ];
  const statusCounts = Object.fromEntries(
    allStatuses.map((s) => [s, rows.filter((r) => r.order.status === s).length])
  );

  const filtered = rows.filter((r) => {
    const contactName = String(r.customer?.contactName ?? "");
    const businessName = String(r.customer?.businessName ?? "");
    const matchesSearch =
      !search ||
      r.order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      contactName.toLowerCase().includes(search.toLowerCase()) ||
      businessName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = rows
    .filter((r) => !["cancelled", "pending_payment"].includes(r.order.status))
    .reduce((sum, r) => sum + r.order.totalAmount, 0);

  const stats = [
    { label: "Total Orders", value: rows.length, icon: ClipboardList, color: "text-blue-500" },
    { label: "Pending Payment", value: statusCounts.pending_payment + statusCounts.payment_submitted, icon: Clock, color: "text-orange-500" },
    { label: "In Processing", value: statusCounts.processing + statusCounts.ready, icon: Package, color: "text-purple-500" },
    { label: "Confirmed Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-emerald-500" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Wholesale Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage B2B orders from payment verification to delivery. All orders fulfilled from HQ.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openBankDialog} className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
            <Landmark className="size-4 text-emerald-500" />
            Bank Transfer Settings
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 bg-muted ${s.color}`}>
                  <s.icon className="size-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <ScrollArea className="w-full sm:max-w-2xl" type="scroll">
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <TabsList className="flex w-max gap-1">
                  <TabsTrigger value="all" className="text-xs">All ({rows.length})</TabsTrigger>
                  <TabsTrigger value="pending_payment" className="text-xs">
                    Pending ({statusCounts.pending_payment})
                  </TabsTrigger>
                  <TabsTrigger value="payment_submitted" className="text-xs">
                    Submitted ({statusCounts.payment_submitted})
                  </TabsTrigger>
                  <TabsTrigger value="payment_confirmed" className="text-xs">
                    Confirmed ({statusCounts.payment_confirmed})
                  </TabsTrigger>
                  <TabsTrigger value="processing" className="text-xs">
                    Processing ({statusCounts.processing})
                  </TabsTrigger>
                  <TabsTrigger value="dispatched" className="text-xs">
                    Dispatched ({statusCounts.dispatched})
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className="text-xs">
                    Delivered ({statusCounts.delivered})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </ScrollArea>
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders…"
                className="pl-9 w-56"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Loading orders…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Package className="size-10 opacity-30" />
              <p className="text-sm">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const cfg = STATUS_CONFIG[row.order.status];
                  const rCustomerName = row.customer?.businessName || row.customer?.contactName || "—";
                  return (
                    <TableRow
                      key={row.order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedRow(row); setDetailOpen(true); }}
                    >
                      <TableCell className="font-mono text-xs font-medium">{row.order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {rCustomerName}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.customer?.email ?? ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {row.items.length} item{row.items.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {formatCurrency(row.order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(row.order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronDown className="size-4 text-muted-foreground rotate-[-90deg]" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      {selectedRow && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="size-5" />
                {selectedRow.order.orderNumber}
                <Badge variant="outline" className={`ml-2 text-xs ${STATUS_CONFIG[selectedRow.order.status].color}`}>
                  {STATUS_CONFIG[selectedRow.order.status].label}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-5 pr-2">
                {/* Order info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
                    <p className="font-medium">
                      {selectedRow.customer?.businessName || selectedRow.customer?.contactName || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedRow.customer?.email ?? ""}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Order Total</p>
                    <p className="font-bold text-lg text-primary">{formatCurrency(selectedRow.order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(selectedRow.order.createdAt)}</p>
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Unit Price</TableHead>
                          <TableHead className="text-xs text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRow.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{item.sku || item.productCode}</p>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {item.quantity} {item.sellingUnit}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(item.unitPriceSnapshot)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatCurrency(item.subtotal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Payment receipt */}
                {selectedRow.receipt ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Payment Receipt
                    </p>
                    <div className="rounded-lg border bg-muted/30 overflow-hidden">
                      {/* Resolve the best available URL for preview */}
                      {(() => {
                        const receipt = selectedRow.receipt!;
                        const previewSrc =
                          receipt.publicUrl ||
                          receipt.localDataUrl ||
                          (receipt.filePath?.startsWith("http") ? receipt.filePath : undefined);
                        const isImage = receipt.mimeType?.startsWith("image/");

                        return (
                          <>
                            {/* Thumbnail */}
                            {isImage && previewSrc ? (
                              <button
                                type="button"
                                className="relative w-full bg-black/20 flex items-center justify-center hover:opacity-90 transition-opacity cursor-zoom-in"
                                style={{ maxHeight: 220 }}
                                onClick={() => setReceiptPreviewUrl(previewSrc)}
                              >
                                <img
                                  src={previewSrc}
                                  alt="Payment receipt thumbnail"
                                  className="w-full object-contain"
                                  style={{ maxHeight: 220 }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40 text-white text-xs font-medium gap-1.5">
                                  <ExternalLink className="size-4" /> Click to preview
                                </span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-center bg-muted/50 py-8">
                                <div className="text-center text-muted-foreground">
                                  <FileText className="size-10 mx-auto mb-1 opacity-50" />
                                  <p className="text-xs">{previewSrc ? "Non-image file" : "Preview unavailable"}</p>
                                </div>
                              </div>
                            )}

                            {/* Receipt meta + action */}
                            <div className="p-3 space-y-1.5 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{receipt.fileName}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Uploaded {formatDate(receipt.uploadedAt)}
                                    {receipt.fileSize ? ` · ${(receipt.fileSize / 1024).toFixed(1)} KB` : ""}
                                  </p>
                                </div>
                                {previewSrc && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs h-8 shrink-0"
                                    onClick={() => setReceiptPreviewUrl(previewSrc)}
                                  >
                                    <ExternalLink className="size-3.5" />
                                    Preview Receipt
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  ["payment_submitted", "payment_confirmed", "processing", "ready", "dispatched", "delivered"].includes(selectedRow.order.status) && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Payment Receipt
                      </p>
                      <div className="rounded-lg border border-dashed bg-muted/20 p-4 flex items-center gap-3 text-muted-foreground text-sm">
                        <ImageIcon className="size-5 opacity-50 shrink-0" />
                        <span>No receipt uploaded yet.</span>
                      </div>
                    </div>
                  )
                )}

                {selectedRow.order.notes && (
                  <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium text-muted-foreground">Notes: </span>
                    {selectedRow.order.notes}
                  </div>
                )}

                <Separator />

                {/* Action buttons */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.order.status === "payment_submitted" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-2 bg-teal-600 hover:bg-teal-500 text-white"
                          onClick={() => setActionDialog({ type: "confirm" })}
                        >
                          <CheckCircle className="size-4" /> Confirm Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                          onClick={() => setActionDialog({ type: "reject" })}
                        >
                          <XCircle className="size-4" /> Reject Payment
                        </Button>
                      </>
                    )}
                    {selectedRow.order.status === "payment_confirmed" && (
                      <Button size="sm" className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
                        onClick={() => setActionDialog({ type: "advance", nextStatus: "processing" })}>
                        <Package className="size-4" /> Move to Processing
                      </Button>
                    )}
                    {selectedRow.order.status === "processing" && (
                      <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                        onClick={() => setActionDialog({ type: "advance", nextStatus: "ready" })}>
                        <Package className="size-4" /> Mark Ready
                      </Button>
                    )}
                    {selectedRow.order.status === "ready" && (
                      <Button size="sm" className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white"
                        onClick={() => setActionDialog({ type: "advance", nextStatus: "dispatched" })}>
                        <Truck className="size-4" /> Mark Dispatched
                      </Button>
                    )}
                    {selectedRow.order.status === "dispatched" && (
                      <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={handleMarkDelivered} disabled={actionLoading}>
                        <CheckCircle className="size-4" /> Mark Delivered
                      </Button>
                    )}
                    {["payment_confirmed", "processing", "ready", "dispatched", "delivered"].includes(selectedRow.order.status) && (
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleGenerateInvoice}>
                        <FileText className="size-4" /> Generate Invoice
                      </Button>
                    )}
                    {["pending_payment", "payment_submitted", "payment_confirmed", "processing", "ready"].includes(
                      selectedRow.order.status
                    ) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                        onClick={() => setActionDialog({ type: "cancel" })}
                      >
                        <RotateCcw className="size-4" /> Cancel Order
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Action Confirm Dialog */}
      {actionDialog && selectedRow && (
        <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionNote(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionDialog.type === "confirm" && "Confirm Payment"}
                {actionDialog.type === "reject" && "Reject Payment"}
                {actionDialog.type === "cancel" && "Cancel Order"}
                {actionDialog.type === "advance" && `Move to ${actionDialog.nextStatus && STATUS_CONFIG[actionDialog.nextStatus].label}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {actionDialog.type === "confirm" && (
                <div className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 text-sm text-teal-700 dark:text-teal-300">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>This will reserve HQ stock for all line items in this order.</span>
                </div>
              )}
              {actionDialog.type === "advance" && actionDialog.nextStatus === "dispatched" && (
                <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-700 dark:text-cyan-300">
                  <Truck className="size-4 mt-0.5 shrink-0" />
                  <span>Dispatching will deduct stock from HQ inventory and release reservations.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {actionDialog.type === "reject" || actionDialog.type === "cancel"
                    ? "Reason (required)"
                    : "Notes (optional)"}
                </Label>
                <Textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    actionDialog.type === "reject" ? "Explain why the payment was rejected…"
                    : actionDialog.type === "cancel" ? "Reason for cancellation…"
                    : "Additional notes…"
                  }
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setActionDialog(null); setActionNote(""); }}>
                Cancel
              </Button>
              <Button
                onClick={executeAction}
                disabled={actionLoading}
                className={`gap-2 ${
                  actionDialog.type === "reject" || actionDialog.type === "cancel"
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : ""
                }`}
              >
                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Bank Transfer Settings Dialog ────────────────────────────────── */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-md border-border/80 shadow-2xl rounded-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Landmark className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Wholesale Bank Account Settings</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Set bank transfer details displayed to wholesale customers for payments.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Bank Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))}
                  placeholder="e.g. Access Bank Plc"
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Account Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={bankForm.bank_account_number}
                  onChange={(e) => setBankForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                  placeholder="e.g. 0123456789"
                  className="pl-9 font-mono bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Account Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={bankForm.bank_account_name}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_account_name: e.target.value }))}
                placeholder="e.g. Just Sly Business Solutions Ltd"
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Instructions / Narration Note</Label>
              <Textarea
                value={bankForm.bank_instructions}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_instructions: e.target.value }))}
                placeholder="Instructions for customer when sending transfer..."
                rows={3}
                className="resize-none text-xs bg-background"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setBankDialogOpen(false)} disabled={savingBank}>
              Cancel
            </Button>
            <Button onClick={handleSaveBank} disabled={savingBank} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
              {savingBank ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
              {savingBank ? "Saving..." : "Save Bank Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Lightbox */}
      <Dialog open={!!receiptPreviewUrl} onOpenChange={() => setReceiptPreviewUrl(null)}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black border-white/10 overflow-hidden">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
            <DialogTitle className="text-white text-sm font-medium">Payment Receipt Preview</DialogTitle>
          </DialogHeader>
          {receiptPreviewUrl && (
            <div className="flex items-center justify-center min-h-[60vh] max-h-[85vh] p-4 pt-14">
              <img
                src={receiptPreviewUrl}
                alt="Payment receipt"
                className="max-w-full max-h-[75vh] object-contain rounded-md shadow-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const p = e.currentTarget.parentElement;
                  if (p) p.innerHTML = '<p class="text-white/60 text-sm">Unable to load image.</p>';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
