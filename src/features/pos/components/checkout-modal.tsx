import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PosCartItem } from "@/services/pos/pos.service";
import { CreditCard, Banknote, Building2, CheckCircle2, Tag } from "lucide-react";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PosCartItem[];
  subtotal: number;
  allowDiscount?: boolean;
  onConfirm: (
    paymentMethod: "cash" | "bank_transfer" | "card",
    discountAmount: number
  ) => Promise<void>;
}

export function CheckoutModal({
  open,
  onOpenChange,
  items,
  subtotal,
  allowDiscount = false,
  onConfirm,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "card">("cash");
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const finalTotal = Math.max(0, subtotal - (isNaN(discount) ? 0 : discount));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(paymentMethod, isNaN(discount) ? 0 : discount);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Confirm Sale Checkout
          </DialogTitle>
          <DialogDescription>
            Review the sale summary and select payment method to complete the transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Total Amount Display Box */}
          <div className="rounded-xl border bg-muted/40 p-4 text-center space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total Amount Payable
            </span>
            <div className="text-3xl font-extrabold text-foreground">
              ₦{finalTotal.toFixed(2)}
            </div>
            {discount > 0 && (
              <p className="text-xs text-emerald-600 font-medium">
                (Subtotal ₦{subtotal.toFixed(2)} - Discount ₦{discount.toFixed(2)})
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Calculated from {items.length} cart {items.length === 1 ? "item" : "items"}
            </p>
          </div>

          {/* Optional Discount Input (if authorized) */}
          {allowDiscount && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Apply Discount (₦)
              </Label>
              <Input
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                placeholder="0.00"
                value={discount === 0 ? "" : discount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDiscount(isNaN(val) ? 0 : Math.min(subtotal, Math.max(0, val)));
                }}
                className="h-9"
              />
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) =>
                setPaymentMethod(value as "cash" | "bank_transfer" | "card")
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <span>Cash</span>
                  </div>
                </SelectItem>
                <SelectItem value="bank_transfer">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span>Bank Transfer</span>
                  </div>
                </SelectItem>
                <SelectItem value="card">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-500" />
                    <span>Card / POS Terminal</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading} className="font-semibold">
            {loading ? "Processing..." : "Confirm & Complete Sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
