"use client";

import { useState } from "react";
import { rejectTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface RejectTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
  sourceBranch: string;
  onSuccess?: () => void;
}

export function RejectTransferModal({
  open,
  onOpenChange,
  transferId,
  transferNumber,
  sourceBranch,
  onSuccess,
}: RejectTransferModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    setError(null);

    if (!reason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setLoading(true);

    try {
      const result = await rejectTransfer({
        transferId,
        reason: reason.trim(),
        rejectedAt: Date.now(),
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
        setReason("");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Transfer</DialogTitle>
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
              <span className="text-slate-600">From:</span>
              <span className="font-medium">{sourceBranch}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Rejection *
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this transfer is being rejected (quality issues, incorrect items, etc.)"
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-900">
            <p className="font-medium mb-1">Reject Transfer</p>
            <p>
              This will return the inventory to the source branch and notify them of the rejection.
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
            <Button
              onClick={handleReject}
              disabled={loading || !reason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
