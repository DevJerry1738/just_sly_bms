import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, Ban, ShieldAlert, FileText, CheckCircle } from "lucide-react";
import type { SalesSchema, SaleItemSchema, SaleVoidSchema, OrganizationSchema } from "@/database/schema";
import { saleItemsRepository } from "@/repositories/sale-items.repository";
import { saleVoidsRepository } from "@/repositories/sale-voids.repository";
import { voidService } from "@/services/pos/void.service";
import { DomainEvents } from "@/services/events/domain-events";
import { ReceiptView } from "@/features/pos/components/receipt-view";
import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import { db } from "@/database/schema";

interface SaleDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SalesSchema | null;
  onSaleUpdated?: () => void;
}

export function SaleDetailModal({
  open,
  onOpenChange,
  sale,
  onSaleUpdated,
}: SaleDetailModalProps) {
  const { user, hasRole } = useAuth();
  const { activeBranch } = useBranch();
  const { hasPermission } = useAuthorization();

  const [items, setItems] = useState<SaleItemSchema[]>([]);
  const [voidRecord, setVoidRecord] = useState<SaleVoidSchema | null>(null);
  const [loading, setLoading] = useState(false);

  // Voiding sub-state
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Reprint modal state
  const [reprintOpen, setReprintOpen] = useState(false);
  const [organization, setOrganization] = useState<OrganizationSchema | null>(null);

  const loadSaleDetails = useCallback(async () => {
    if (!sale) return;
    setLoading(true);
    try {
      const lineItems = await saleItemsRepository.getBySaleId(sale.id);
      setItems(lineItems);

      if (sale.status === "voided") {
        const vRecord = await saleVoidsRepository.getBySaleId(sale.id);
        setVoidRecord(vRecord ?? null);
      } else {
        setVoidRecord(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sale]);

  useEffect(() => {
    if (open && sale) {
      void loadSaleDetails();
      db.organizations.toArray().then((orgs) => {
        if (orgs.length > 0) setOrganization(orgs[0]);
      }).catch(console.error);
    } else {
      setVoiding(false);
      setVoidReason("");
    }
  }, [open, sale, loadSaleDetails]);

  if (!sale) return null;

  const canVoid = hasPermission("sales:delete") || hasRole("admin") || hasRole("manager");

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please enter a reason for voiding this sale.");
      return;
    }
    if (!user?.id || !activeBranch?.id) {
      toast.error("User and active branch required.");
      return;
    }

    setVoidSubmitting(true);
    try {
      const res = await voidService.voidSale({
        saleId: sale.id,
        reason: voidReason.trim(),
        voidedBy: user.id,
        voidedByName: user.email ?? user.id,
        branchId: activeBranch.id,
      });

      if (!res.success) {
        toast.error(res.error ?? "Failed to void sale.");
        return;
      }

      toast.success(`Sale ${sale.saleNumber} has been voided and inventory returned.`);
      setVoiding(false);
      setVoidReason("");
      if (onSaleUpdated) onSaleUpdated();
      void loadSaleDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error voiding sale.");
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleReprintEvent = () => {
    void DomainEvents.publish(
      "SALE_REPRINTED",
      {
        entity: "Sale",
        entityId: sale.id,
        saleNumber: sale.saleNumber,
      },
      { userId: user?.id, branchId: activeBranch?.id }
    );
    toast.info(`Reprint logged for ${sale.saleNumber}.`);
  };

  const isVoided = sale.status === "voided";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg font-bold">
                <FileText className="h-5 w-5 text-primary" />
                Sale Details — {sale.saleNumber}
              </span>
              <Badge variant={isVoided ? "destructive" : "default"}>
                {sale.status.toUpperCase()}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Body Content */}
          <div className="space-y-4 py-2 text-sm">
            {/* Meta info strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg text-xs">
              <div>
                <span className="text-muted-foreground block">Date & Time</span>
                <span className="font-semibold">{new Date(sale.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cashier</span>
                <span className="font-semibold">{sale.createdByName ?? sale.createdBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Method</span>
                <span className="font-semibold capitalize">{sale.paymentMethod.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Status</span>
                <span className="font-semibold capitalize">{sale.paymentStatus}</span>
              </div>
            </div>

            {/* Void notification if voided */}
            {isVoided && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  This sale was VOIDED on {sale.voidedAt ? new Date(sale.voidedAt).toLocaleString() : "N/A"}
                </div>
                {voidRecord?.reason && (
                  <p className="text-muted-foreground">Reason: "{voidRecord.reason}"</p>
                )}
                {voidRecord?.inventoryReversed && (
                  <p className="text-emerald-600 font-medium">✓ Inventory restored to stock balance</p>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center">Unit</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Price</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        Loading sale line items...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No line items found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-medium">{item.productName}</td>
                        <td className="p-2.5 text-center text-muted-foreground">
                          {item.packagingLabel || "Base"}
                        </td>
                        <td className="p-2.5 text-center font-semibold">{item.quantity}</td>
                        <td className="p-2.5 text-right">₦{item.unitPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold">₦{item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-col items-end space-y-1 text-xs pt-2">
              {sale.discountAmount > 0 && (
                <div className="flex justify-between w-48 text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₦{(sale.totalAmount + sale.discountAmount).toFixed(2)}</span>
                </div>
              )}
              {sale.discountAmount > 0 && (
                <div className="flex justify-between w-48 text-emerald-600 font-medium">
                  <span>Discount:</span>
                  <span>-₦{sale.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between w-48 text-sm font-extrabold border-t pt-1">
                <span>Total:</span>
                <span>₦{sale.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Void Action Drawer */}
            {voiding && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <Label className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <Ban className="h-3.5 w-3.5" />
                  Reason for Voiding Sale
                </Label>
                <Textarea
                  placeholder="Enter detailed reason for voiding (required)..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="text-xs h-16"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setVoiding(false)}
                    disabled={voidSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleVoid}
                    disabled={voidSubmitting}
                  >
                    {voidSubmitting ? "Voiding..." : "Confirm Void Sale"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div>
              {!isVoided && !voiding && canVoid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setVoiding(true)}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  Void Sale
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" onClick={() => setReprintOpen(true)}>
                <Printer className="h-3.5 w-3.5 mr-1" />
                Reprint Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {reprintOpen && (
        <ReceiptView
          open={reprintOpen}
          onOpenChange={setReprintOpen}
          sale={sale}
          items={items}
          branch={activeBranch}
          organization={organization}
          isReprint={true}
          onReprint={handleReprintEvent}
        />
      )}
    </>
  );
}
