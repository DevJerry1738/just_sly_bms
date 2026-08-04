"use client";

import { useState, useEffect } from "react";
import { useAuthorization } from "@/hooks/use-authorization";
import { listBranchTransfers } from "../transfer.functions";
import { PageWrapper } from "@/components/common/page-wrapper";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import type { InventoryTransferSchema } from "@/database/schema";

interface BranchTransfersPageProps {
  branchId: string;
  onCreateClick: () => void;
}

export function BranchTransfersPage({ branchId, onCreateClick }: BranchTransfersPageProps) {
  const { hasPermission } = useAuthorization();
  const [transfers, setTransfers] = useState<InventoryTransferSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "sent" | "received">("all");

  useEffect(() => {
    const loadTransfers = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await listBranchTransfers({
          branchId,
          direction: "all",
        });

        if (result.success) {
          setTransfers(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transfers");
      } finally {
        setLoading(false);
      }
    };

    loadTransfers();
  }, [branchId]);

  const filteredTransfers = transfers.filter((t) => {
    if (filterType === "all") return true;
    if (filterType === "sent") return t.sourceBranchId === branchId;
    if (filterType === "received") return t.destinationBranchId === branchId;
    return true;
  });

  const stats = [
    {
      label: "Total Transfers",
      value: transfers.length.toString(),
      trend: "neutral",
    },
    {
      label: "Sent",
      value: transfers.filter((t) => t.sourceBranchId === branchId).length.toString(),
      trend: "neutral",
    },
    {
      label: "Received",
      value: transfers.filter((t) => t.destinationBranchId === branchId && t.status === "received").length.toString(),
      trend: "positive",
    },
    {
      label: "Pending",
      value: transfers.filter((t) => t.status === "pending_receipt" || t.status === "dispatched").length.toString(),
      trend: "warning",
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

  const canCreateTransfer = hasPermission("inventory:create");

  return (
    <PageWrapper
      title="Branch Transfers"
      description="Manage inventory transfers between branches"
      action={
        canCreateTransfer ? (
          <Button onClick={onCreateClick} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Transfer
          </Button>
        ) : undefined
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "sent", "received"] as const).map((type) => (
          <Button
            key={type}
            variant={filterType === type ? "default" : "outline"}
            onClick={() => setFilterType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {/* Transfers List */}
      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title="No transfers yet"
          description="Create your first transfer to get started"
          action={
            <Button onClick={onCreateClick}>Create Transfer</Button>
          }
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Transfer #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  From
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  To
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
                    {transfer.sourceBranchId === branchId ? "This Branch" : transfer.sourceBranchId}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {transfer.destinationBranchId === branchId ? "This Branch" : transfer.destinationBranchId}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">--</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(transfer.status)}`}>
                      {transfer.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(transfer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Button variant="ghost" size="sm">
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
