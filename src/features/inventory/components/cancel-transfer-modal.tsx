"use client";

import { useState } from "react";
import { cancelTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";

interface CancelTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
  onSuccess?: () => void;
}

export function CancelTransferModal({
  open,
  onOpenChange,
  transferId,
  transferNumber,
  onSuccess,
}: CancelTransferModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setError(null);

    if (!reason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);

    try {
      const result = await cancelTransfer({
        transferId,
        reason: reason.trim(),
        cancelledAt: Date.now(),
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
        setReason("");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Transfer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 bg-slate-50 p-4 rounded">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Transfer #:</span>
              <span className="font-medium">{transferNumber}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Reason for Cancellation *
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this supply is being cancelled"
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-900">
            <p className="font-medium mb-1">Cancel Supply</p>
            <p>
              Cancelling will release reserved stock and mark this supply as cancelled. This can only be done before dispatch.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Close
            </Button>
            <Button
              onClick={handleCancel}
              disabled={loading || !reason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
