"use client";

import { useState, useEffect } from "react";
import { getPendingReceipts } from "../transfer.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InventoryTransferSchema } from "@/database/schema";

interface PendingReceiptsListProps {
  branchId: string;
  onReceiptClick?: (transferId: string) => void;
}

export function PendingReceiptsList({ branchId, onReceiptClick }: PendingReceiptsListProps) {
  const [transfers, setTransfers] = useState<InventoryTransferSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPending = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getPendingReceipts({ branchId });

        if (result.success) {
          setTransfers(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pending receipts");
      } finally {
        setLoading(false);
      }
    };

    loadPending();
  }, [branchId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Receipts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pending Receipts</span>
          {transfers.length > 0 && (
            <Badge variant="secondary">{transfers.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : transfers.length === 0 ? (
          <div className="text-sm text-slate-600 text-center py-8">
            No pending receipts
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {transfer.transferNumber}
                  </div>
                  <div className="text-xs text-slate-600">
                    From: {transfer.sourceBranchId}
                  </div>
                  {transfer.expectedArrivalDate && (
                    <div className="text-xs text-slate-600">
                      Expected: {new Date(transfer.expectedArrivalDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReceiptClick?.(transfer.id)}
                >
                  Confirm Receipt
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
