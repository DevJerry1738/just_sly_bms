"use client";

import { useState } from "react";
import { receiveTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface ConfirmReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
  onSuccess?: () => void;
}

export function ConfirmReceiptModal({
  open,
  onOpenChange,
  transferId,
  transferNumber,
  onSuccess,
}: ConfirmReceiptModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await receiveTransfer({
        transferId,
        receivedAt: Date.now(),
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="bg-slate-50 p-4 rounded">
            <p className="text-sm text-slate-600">Transfer Number:</p>
            <p className="text-lg font-semibold">{transferNumber}</p>
          </div>

          <div className="py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to confirm receipt of this transfer? This will update your inventory accordingly.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
