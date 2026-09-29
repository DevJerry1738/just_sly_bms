import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PauseCircle } from "lucide-react";
import type { PosCartItem } from "@/services/pos/pos.service";

interface HoldCartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PosCartItem[];
  subtotal: number;
  onConfirm: (referenceLabel: string, notes?: string) => Promise<void>;
}

export function HoldCartDialog({
  open,
  onOpenChange,
  items,
  subtotal,
  onConfirm,
}: HoldCartDialogProps) {
  const [referenceLabel, setReferenceLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onConfirm(referenceLabel, notes);
      setReferenceLabel("");
      setNotes("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-500" />
            Hold Current Cart
          </DialogTitle>
          <DialogDescription>
            Park this transaction so you can attend to the next customer. You can resume it anytime.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/60 p-3 flex justify-between items-center text-sm">
            <div>
              <span className="text-muted-foreground">Items in cart:</span>{" "}
              <span className="font-semibold">{itemCount} items</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-bold text-base">₦{subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">
              Customer / Reference Label{" "}
              <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="reference"
              placeholder="e.g. John Doe, Customer in blue shirt, Table 3..."
              value={referenceLabel}
              onChange={(e) => setReferenceLabel(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              If left empty, a timestamp will be assigned automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="e.g. Stepped out to withdraw cash, will return in 5 mins"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              disabled={submitting}
            >
              <PauseCircle className="h-4 w-4" />
              {submitting ? "Parking..." : "Confirm & Hold"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
