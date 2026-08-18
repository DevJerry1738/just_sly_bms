"use client";

import { useState, useEffect } from "react";
import { listBranchTransfers } from "../transfer.functions";
import { PageWrapper } from "@/components/common/page-wrapper";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import type { InventoryTransferSchema } from "@/database/schema";

interface HQSuppliesPageProps {
  branchId: string;
  refreshKey?: number;
  onCreateClick: () => void;
  onViewClick?: (transferId: string, transfer?: InventoryTransferSchema) => void;
}

export function HQSuppliesPage({ branchId, refreshKey, onCreateClick, onViewClick }: HQSuppliesPageProps) {
  const [transfers, setTransfers] = useState<Array<InventoryTransferSchema & {
    itemCount?: number;
    sourceBranchName?: string;
    destinationBranchName?: string;
  }>>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listBranchTransfers({
        branchId,
        direction: "source",
      });

      if (result.success) {
        setTransfers(result.data ?? []);
      } else {
        setError(result.error ?? "Failed to load supplies");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load supplies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [branchId, refreshKey]);

  const filteredTransfers = showCancelled
    ? transfers.filter((transfer) => transfer.status === "cancelled")
    : transfers;

  const stats = [
    {
      label: "Total Supplies",
      value: transfers.length.toString(),
      trend: "neutral",
    },
    {
      label: "Pending Dispatch",
      value: transfers.filter((t) => t.status === "draft").length.toString(),
      trend: "neutral",
    },
    {
      label: "Dispatched",
      value: transfers.filter((t) => t.status === "dispatched").length.toString(),
      trend: "neutral",
    },
    {
      label: "Completed",
      value: transfers.filter((t) => t.status === "received").length.toString(),
      trend: "positive",
    },
    {
      label: "Cancelled",
      value: transfers.filter((t) => t.status === "cancelled").length.toString(),
      trend: "negative",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-slate-100 text-slate-800",
      pending_dispatch: "bg-yellow-100 text-yellow-800",
      dispatched: "bg-blue-100 text-blue-800",
      in_transit: "bg-purple-100 text-purple-800",
      pending_receipt: "bg-orange-100 text-orange-800",
      received: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  };

  return (
    <PageWrapper
      title="HQ Supplies"
      description="Manage inventory supplies from headquarters to branches"
      action={
        <Button onClick={onCreateClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Supply
        </Button>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={showCancelled ? "outline" : "secondary"}
          size="sm"
          onClick={() => setShowCancelled(false)}
        >
          All
        </Button>
        <Button
          variant={showCancelled ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowCancelled(true)}
        >
          Cancelled
        </Button>
      </div>

      {/* Supplies List */}
      {error ? (
        <ErrorState description={error} onRetry={loadTransfers} />
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState
          title="No supplies yet"
          description="Create your first supply transfer to get started"
          action={
            <Button onClick={onCreateClick}>Create Supply</Button>
          }
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Supply #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {transfer.transferNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {transfer.destinationBranchName || transfer.destinationBranchId}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {transfer.itemCount != null ? transfer.itemCount : "--"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(transfer.status)}`}>
                      {transfer.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(transfer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewClick?.(transfer.id, transfer)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageWrapper>
  );
}
