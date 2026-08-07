"use client";

import { useState } from "react";
import { dispatchTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface DispatchTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  onSuccess?: () => void;
}

export function DispatchTransferModal({
  open,
  onOpenChange,
  transferId,
  transferNumber,
  itemCount,
  totalQuantity,
  totalValue,
  onSuccess,
}: DispatchTransferModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDispatch = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await dispatchTransfer({
        transferId,
        dispatchedAt: Date.now(),
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispatch Transfer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 bg-slate-50 p-4 rounded">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Transfer #:</span>
              <span className="font-medium">{transferNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Items:</span>
              <span className="font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Qty:</span>
              <span className="font-medium">{totalQuantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Value:</span>
              <span className="font-medium">₦{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-900">
            <p className="font-medium mb-1">Action</p>
            <p>
              This will deduct inventory from the source branch and mark the transfer as dispatched.
              The destination branch will see this as a pending receipt.
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
            <Button onClick={handleDispatch} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Dispatch
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
