import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Clock, Package, Upload, FileText,
  CheckCircle2, XCircle, Truck, Loader2,
  ChevronDown, ChevronUp, LogOut, ShoppingCart,
  Landmark, Copy, Check, Building2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { APP_CONFIG } from "@/config/app";
import logoNoBg from "@/assets/logo_no_bg.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { customerRepository } from "@/repositories/customer.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { wholesaleOrderRepository } from "@/repositories/wholesale-order.repository";
import { wholesaleOrderItemRepository } from "@/repositories/wholesale-order-item.repository";
import { wholesaleOrderService } from "@/services/wholesale/wholesale-order.service";
import type {
  WholesaleOrderSchema,
  WholesaleOrderItemSchema,
  WholesaleOrderStatus,
  CustomerAccountSchema,
  OrganizationSchema,
} from "@/database/schema";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<WholesaleOrderStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending_payment:   { label: "Pending Payment",    color: "text-orange-400",  bg: "border-orange-500/30 bg-orange-500/10",  icon: Clock },
  payment_submitted: { label: "Payment Submitted",  color: "text-blue-400",    bg: "border-blue-500/30 bg-blue-500/10",      icon: Upload },
  payment_confirmed: { label: "Payment Confirmed",  color: "text-teal-400",    bg: "border-teal-500/30 bg-teal-500/10",      icon: CheckCircle2 },
  processing:        { label: "Processing",          color: "text-purple-400",  bg: "border-purple-500/30 bg-purple-500/10",  icon: Package },
  ready:             { label: "Ready",               color: "text-indigo-400",  bg: "border-indigo-500/30 bg-indigo-500/10",  icon: Package },
  dispatched:        { label: "Dispatched",          color: "text-cyan-400",    bg: "border-cyan-500/30 bg-cyan-500/10",      icon: Truck },
  delivered:         { label: "Delivered",           color: "text-emerald-400", bg: "border-emerald-500/30 bg-emerald-500/10",icon: CheckCircle2 },
  cancelled:         { label: "Cancelled",           color: "text-red-400",     bg: "border-red-500/30 bg-red-500/10",        icon: XCircle },
};

interface OrderWithItems {
  order: WholesaleOrderSchema;
  items: WholesaleOrderItemSchema[];
}

export function PortalOrdersPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerAccountSchema | null>(null);
  const [org, setOrg] = useState<OrganizationSchema | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Receipt upload state
  const [receiptDialogOrder, setReceiptDialogOrder] = useState<WholesaleOrderSchema | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auth + load orders + org
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          if (mounted) navigate({ to: "/portal/login" });
          return;
        }
        const cust = await customerRepository.getByEmail(data.session.user.email ?? "");
        if (!cust || cust.status !== "active") {
          if (mounted) navigate({ to: "/portal/login" });
          return;
        }
        if (!mounted) return;
        setCustomer(cust);

        const [orgData, rawOrders] = await Promise.all([
          organizationRepository.getPrimaryOrganization(),
          wholesaleOrderRepository.getByCustomerId(cust.id),
        ]);
        const withItems = await Promise.all(
          rawOrders.map(async (order) => ({
            order,
            items: await wholesaleOrderItemRepository.getByOrderId(order.id),
          }))
        );
        if (!mounted) return;
        setOrg(orgData);
        setOrders(withItems.sort((a, b) => b.order.createdAt - a.order.createdAt));
      } catch (err) {
        console.error("Portal orders load error:", err);
        if (mounted) toast.error("Failed to load orders");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [navigate]);

  const refreshOrders = async (customerId: string) => {
    const rawOrders = await wholesaleOrderRepository.getByCustomerId(customerId);
    const withItems: OrderWithItems[] = await Promise.all(
      rawOrders.map(async (order: WholesaleOrderSchema) => ({
        order,
        items: await wholesaleOrderItemRepository.getByOrderId(order.id),
      }))
    );
    setOrders(withItems.sort((a: OrderWithItems, b: OrderWithItems) => b.order.createdAt - a.order.createdAt));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/portal/login" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleReceiptUpload = async () => {
    if (!receiptDialogOrder || !customer) return;
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    setUploading(true);
    try {
      // Always read file as data URL for local admin preview (works even if Supabase fails)
      const localDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile);
      });

      const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
      const sanitizedFileName = `${Date.now()}.${ext}`;
      const storagePath = `${receiptDialogOrder.id}/${sanitizedFileName}`;
      let publicUrl = `local-upload/${storagePath}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("payment-receipt")
          .upload(storagePath, selectedFile, {
            contentType: selectedFile.type || "image/jpeg",
            upsert: true,
          });

        if (!uploadError) {
          // Get the actual public CDN URL so admins can view the receipt
          const { data: urlData } = supabase.storage
            .from("payment-receipt")
            .getPublicUrl(storagePath);
          publicUrl = urlData?.publicUrl ?? `payment-receipt/${storagePath}`;
        } else {
          console.warn("Supabase storage upload error (using local data URL for preview):", uploadError);
        }
      } catch (storageErr) {
        console.warn("Supabase storage connection error (using local data URL for preview):", storageErr);
      }

      await wholesaleOrderService.submitPaymentReceipt(receiptDialogOrder.id, customer.id, {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        storagePath: publicUrl,
        localDataUrl,
      });

      toast.success("Payment receipt submitted!", {
        description: "Your receipt has been submitted and is awaiting confirmation.",
      });

      setReceiptDialogOrder(null);
      setSelectedFile(null);
      await refreshOrders(customer.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <img src={logoNoBg} alt={APP_CONFIG.name} className="h-12 w-auto object-contain animate-pulse" />
          <div className="flex items-center gap-2 text-sm mt-2">
            <Loader2 className="size-4 animate-spin text-indigo-400" />
            <span>Loading your orders…</span>
          </div>
        </div>
      </div>
    );
  }

  const bankName = org?.bank_name || "Access Bank Plc";
  const bankAccNum = org?.bank_account_number || "0123456789";
  const bankAccName = org?.bank_account_name || "Just Sly Business Solutions Ltd";
  const bankInstructions = org?.bank_instructions || "Please use your Order Number as the transfer reference/narration.";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-primary/30">

      {/* ── Brand Navigation Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/portal/shop" })}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back to Shop</span>
            </button>

            <div className="hidden sm:flex items-center h-5 border-l border-white/10" />

            <div className="flex items-center gap-2.5">
              <img src={logoNoBg} alt={APP_CONFIG.name} className="h-7 w-auto object-contain" />
              <div>
                <span className="text-sm font-bold text-white">{APP_CONFIG.name}</span>
                <span className="ml-2 text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">My Orders</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/portal/shop" })}
              className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white text-xs gap-1.5 h-9"
            >
              <ShoppingCart className="size-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Browse Catalogue</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white hover:bg-white/10 h-9 w-9"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">

        {/* ── Page Title + Customer Context ──────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Order History</h1>
            <p className="text-sm text-slate-400 mt-1">
              {orders.length > 0
                ? `${orders.length} order${orders.length !== 1 ? "s" : ""} — upload receipts for pending payments`
                : "No orders yet — start shopping in the catalogue"}
            </p>
          </div>
          {customer && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
              <Building2 className="size-3.5 text-indigo-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">{customer.businessName || customer.contactName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{customer.customerCode}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Orders ─────────────────────────────────────────────────── */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-white/10 rounded-2xl bg-white/5">
            <Package className="size-12 opacity-30 text-slate-400" />
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300">No orders yet</p>
              <p className="text-xs text-slate-500">Place your first wholesale order from the catalogue.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-400 gap-1.5"
              onClick={() => navigate({ to: "/portal/shop" })}
            >
              <ShoppingCart className="size-4" />
              Browse Catalogue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(({ order, items }) => {
              const cfg = STATUS_CONFIG[order.status];
              const Icon = cfg.icon;
              const isExpanded = expandedOrderId === order.id;
              const canUploadReceipt = order.status === "pending_payment";
              const receiptSubmitted = order.status === "payment_submitted";

              return (
                <Card
                  key={order.id}
                  className={`overflow-hidden border-white/10 bg-slate-900/60 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 ${
                    isExpanded ? "shadow-xl shadow-indigo-500/5" : ""
                  }`}
                >
                  {/* Order header — always visible */}
                  <CardHeader
                    className="cursor-pointer pb-4 hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-white font-mono text-sm tracking-wide">{order.orderNumber}</span>
                          <Badge variant="outline" className={`text-[10px] ${cfg.bg} ${cfg.color} border`}>
                            <Icon className="size-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-indigo-300 font-mono">{formatCurrency(order.totalAmount)}</p>
                          <p className="text-[10px] text-slate-400">{items.length} item{items.length !== 1 ? "s" : ""}</p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="size-4 text-slate-500" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expanded details */}
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-5 border-t border-white/10">
                      {/* Items breakdown */}
                      <div className="space-y-2 pt-4">
                        <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Items Ordered</p>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate">{item.productName}</p>
                              <p className="text-slate-400 mt-0.5">
                                <span className="font-mono">{item.quantity}×</span> {item.sellingUnit} · {formatCurrency(item.unitPriceSnapshot)} ea.
                              </p>
                            </div>
                            <span className="font-mono font-bold text-indigo-300 shrink-0">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold pt-2 px-2">
                          <span className="text-slate-300">Order Total</span>
                          <span className="text-indigo-300 font-mono">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">Notes: </span>{order.notes}
                        </div>
                      )}

                      {/* Pending Payment — show bank details + upload prompt */}
                      {canUploadReceipt && (
                        <div className="space-y-3">
                          {/* Bank Transfer Box */}
                          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                              <Landmark className="size-3.5" />
                              <span>Send Payment to This Account</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Bank Name</p>
                                <p className="font-semibold text-white mt-0.5">{bankName}</p>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Account Number</p>
                                  <p className="font-semibold font-mono text-indigo-300 mt-0.5">{bankAccNum}</p>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(bankAccNum, "Account Number")}
                                  className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                  {copiedField === "Account Number" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                                </button>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Account Name</p>
                                <p className="font-semibold text-white mt-0.5">{bankAccName}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-300 border-t border-white/10 pt-3">
                              <span className="text-orange-400 font-semibold">Important:</span> {bankInstructions}
                            </p>
                          </div>

                          {/* Upload button */}
                          <div className="rounded-xl border border-orange-500/25 bg-orange-500/8 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-2 text-xs text-orange-300">
                              <AlertCircle className="size-4 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold">Payment Required</p>
                                <p className="text-orange-400/70 mt-0.5">
                                  Transfer <strong className="text-orange-300">{formatCurrency(order.totalAmount)}</strong> then upload your bank receipt.
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => setReceiptDialogOrder(order)}
                              className="bg-orange-500 hover:bg-orange-400 text-white gap-2 shrink-0 shadow-lg shadow-orange-500/20"
                            >
                              <Upload className="size-3.5" />
                              Upload Receipt
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Receipt submitted — waiting */}
                      {receiptSubmitted && (
                        <div className="flex items-center gap-3 text-xs text-blue-300 rounded-xl bg-blue-500/10 border border-blue-500/25 px-4 py-3">
                          <FileText className="size-4 shrink-0" />
                          <p>Receipt submitted and under review. We'll update your order once payment is confirmed.</p>
                        </div>
                      )}

                      {/* Delivered */}
                      {order.status === "delivered" && (
                        <div className="flex items-center gap-3 text-xs text-emerald-300 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3">
                          <CheckCircle2 className="size-4 shrink-0" />
                          <p>Order delivered successfully. Thank you for your business!</p>
                        </div>
                      )}

                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Payment Receipt Upload Dialog ────────────────────────────────── */}
      <Dialog open={!!receiptDialogOrder} onOpenChange={(open) => !open && setReceiptDialogOrder(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Upload className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">Upload Payment Receipt</DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Submit your bank transfer proof for order <strong className="text-indigo-300">{receiptDialogOrder?.orderNumber}</strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {receiptDialogOrder && (
            <div className="space-y-4 text-xs">
              {/* HQ Bank Details reminder */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-2">
                <p className="text-[10px] uppercase font-semibold text-indigo-400 tracking-wider flex items-center gap-1">
                  <Landmark className="size-3" /> Transfer-to Account
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Bank", value: bankName },
                    { label: "Acct No.", value: bankAccNum, mono: true },
                    { label: "Acct Name", value: bankAccName, span: true },
                  ].map(({ label, value, mono, span }) => (
                    <div key={label} className={span ? "col-span-2" : ""}>
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className={`font-semibold text-white ${mono ? "font-mono text-indigo-300" : ""}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-orange-300 text-[11px] pt-1 border-t border-white/10">
                  Narration: Use <strong>{receiptDialogOrder.orderNumber}</strong> as transfer reference
                </p>
              </div>

              {/* Amount */}
              <div className="flex justify-between items-center rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <span className="text-slate-400">Amount to Transfer:</span>
                <span className="font-mono font-bold text-indigo-300 text-base">{formatCurrency(receiptDialogOrder.totalAmount)}</span>
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-medium flex items-center gap-1">
                  Receipt File / Image <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="bg-white/5 border-white/10 text-white text-xs file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:text-white file:text-[10px] file:px-3 file:py-1.5 hover:file:bg-indigo-500 cursor-pointer h-auto py-2"
                />
                <p className="text-[10px] text-slate-500">Accepted: PDF, JPG, PNG · Max 10MB</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => setReceiptDialogOrder(null)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white gap-2 font-semibold"
              onClick={handleReceiptUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? (
                <><Loader2 className="size-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="size-4" /> Submit Receipt</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
