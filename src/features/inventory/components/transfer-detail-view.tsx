"use client";

import { useEffect, useState } from "react";
import { getTransfer } from "../transfer.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/common/error-state";
import type { InventoryTransferSchema, InventoryTransferItemSchema } from "@/database/schema";

interface TransferDetailViewProps {
  transferId: string;
  onBack?: () => void;
  onDispatch?: (transferId: string) => void;
  onReceipt?: (transferId: string) => void;
  onReject?: (transferId: string) => void;
}

interface TransferDetail {
  transfer: InventoryTransferSchema | undefined;
  items: InventoryTransferItemSchema[];
  stats: {
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
  };
}

export function TransferDetailView({
  transferId,
  onBack,
  onDispatch,
  onReceipt,
  onReject,
}: TransferDetailViewProps) {
  const [data, setData] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTransfer = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getTransfer({ transferId });

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transfer");
      } finally {
        setLoading(false);
      }
    };

    loadTransfer();
  }, [transferId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data?.transfer) {
    return <ErrorState message={error || "Transfer not found"} />;
  }

  const transfer = data.transfer;
  const statusColor: Record<string, string> = {
    draft: "bg-slate-100 text-slate-800",
    pending_dispatch: "bg-yellow-100 text-yellow-800",
    dispatched: "bg-blue-100 text-blue-800",
    in_transit: "bg-purple-100 text-purple-800",
    pending_receipt: "bg-orange-100 text-orange-800",
    received: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };

  const canDispatch = transfer.status === "draft" || transfer.status === "pending_dispatch";
  const canReceipt = transfer.status === "dispatched" || transfer.status === "in_transit";
  const canReject = transfer.status === "pending_receipt" || transfer.status === "dispatched";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-sm text-slate-600">
              {transfer.transferType === "hq_supply" ? "HQ Supply" : "Branch Transfer"}
            </p>
          </div>
        </div>
        <Badge className={statusColor[transfer.status]}>
          {transfer.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Source Branch</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{transfer.sourceBranchId}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Destination Branch</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{transfer.destinationBranchId}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Created</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {new Date(transfer.createdAt).toLocaleDateString()}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.stats.itemCount}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.stats.totalQuantity}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">${data.stats.totalValue.toFixed(2)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expected Arrival</CardTitle>
          </CardHeader>
          <CardContent>
            {transfer.expectedArrivalDate
              ? new Date(transfer.expectedArrivalDate).toLocaleDateString()
              : "—"}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <div className="text-center py-8 text-slate-600">No items in this transfer</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Product ID</th>
                    <th className="px-4 py-2 text-left">Packaging</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Unit Cost</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{item.productId}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {item.packagingUnit || "Base"}
                      </td>
                      <td className="px-4 py-2 text-right">{item.convertedBaseQuantity}</td>
                      <td className="px-4 py-2 text-right">${item.unitCostSnapshot.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        ${(item.convertedBaseQuantity * item.unitCostSnapshot).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {transfer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">{transfer.notes}</CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canDispatch && onDispatch && (
          <Button onClick={() => onDispatch(transferId)}>Dispatch Transfer</Button>
        )}
        {canReceipt && onReceipt && (
          <Button onClick={() => onReceipt(transferId)} className="bg-green-600 hover:bg-green-700">
            Confirm Receipt
          </Button>
        )}
        {canReject && onReject && (
          <Button onClick={() => onReject(transferId)} variant="destructive">
            Reject Transfer
          </Button>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Created</p>
              <p className="text-slate-600">
                {new Date(transfer.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {transfer.dispatchedAt && (
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Dispatched</p>
                <p className="text-slate-600">
                  {new Date(transfer.dispatchedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {transfer.receivedAt && (
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Received</p>
                <p className="text-slate-600">
                  {new Date(transfer.receivedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {transfer.rejectedAt && (
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Rejected</p>
                <p className="text-slate-600">
                  {new Date(transfer.rejectedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
