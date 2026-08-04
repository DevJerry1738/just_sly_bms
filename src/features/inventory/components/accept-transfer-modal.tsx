"use client";

import { useState } from "react";
import { receiveTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface AcceptTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
  sourceBranch: string;
  onSuccess?: () => void;
}

export function AcceptTransferModal({
  open,
  onOpenChange,
  transferId,
  transferNumber,
  sourceBranch,
  onSuccess,
}: AcceptTransferModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
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
      setError(err instanceof Error ? err.message : "Failed to accept transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept Transfer</DialogTitle>
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

          <div className="bg-green-50 border border-green-200 p-3 rounded text-sm text-green-900">
            <p className="font-medium mb-1">Accept Transfer</p>
            <p>
              This will add the transferred items to your branch inventory and mark the transfer as received.
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
            <Button onClick={handleAccept} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
