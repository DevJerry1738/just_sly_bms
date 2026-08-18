"use client";

import { useState, useEffect } from "react";
import { useBranch } from "@/providers/branch-provider";
import { useAuth } from "@/providers/auth-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import { HQSuppliesPage } from "./hq-supplies-page";
import { BranchTransfersPage } from "./branch-transfers-page";
import { CreateTransferModal } from "./create-transfer-modal";
import { DispatchTransferModal } from "./dispatch-transfer-modal";
import { ConfirmReceiptModal } from "./confirm-receipt-modal";
import { AcceptTransferModal } from "./accept-transfer-modal";
import { RejectTransferModal } from "./reject-transfer-modal";
import { CancelTransferModal } from "./cancel-transfer-modal";
import { TransferDetailView } from "./transfer-detail-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InventoryTransferSchema } from "@/database/schema";

interface TransferManagementState {
  view: "list" | "detail";
  selectedTransferId?: string;
  selectedTransfer?: InventoryTransferSchema & {
    itemCount?: number;
    totalQuantity?: number;
    totalValue?: number;
  };
  createModal: {
    open: boolean;
    type: "hq_supply" | "branch_transfer";
  };
  dispatchModal: {
    open: boolean;
    transferId?: string;
  };
  receiptModal: {
    open: boolean;
    transferId?: string;
  };
  acceptModal: {
    open: boolean;
    transferId?: string;
  };
  rejectModal: {
    open: boolean;
    transferId?: string;
  };
  cancelModal: {
    open: boolean;
    transferId?: string;
  };
  activeTab: "hq" | "branch";
  refreshKey: number;
}

export function TransferManagementPage() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const { isSuperAdmin } = useAuthorization();
  const [state, setState] = useState<TransferManagementState>({
    view: "list",
    createModal: { open: false, type: "hq_supply" },
    dispatchModal: { open: false },
    receiptModal: { open: false },
    acceptModal: { open: false },
    rejectModal: { open: false },
    cancelModal: { open: false, transferId: undefined },
    activeTab: "hq",
    refreshKey: 0,
  });

  useEffect(() => {
    if (!isSuperAdmin && state.activeTab === "hq") {
      setState((prev) => ({ ...prev, activeTab: "branch" }));
    }
  }, [isSuperAdmin, state.activeTab]);

  const branchId = activeBranch?.id || "";

  const handleCreateSupply = () => {
    setState((prev) => ({
      ...prev,
      createModal: { open: true, type: "hq_supply" },
    }));
  };

  const handleCreateTransfer = () => {
    setState((prev) => ({
      ...prev,
      createModal: { open: true, type: "branch_transfer" },
    }));
  };

  const handleViewTransfer = (transferId: string, transfer?: any) => {
    setState((prev) => ({
      ...prev,
      view: "detail",
      selectedTransferId: transferId,
      selectedTransfer: transfer,
    }));
  };

  const handleBackToList = () => {
    setState((prev) => ({
      ...prev,
      view: "list",
      selectedTransferId: undefined,
    }));
  };

  const handleDispatch = (
    transferId: string,
    transfer?: any,
    stats?: { itemCount: number; totalQuantity: number; totalValue: number },
  ) => {
    setState((prev) => ({
      ...prev,
      dispatchModal: { open: true, transferId },
      selectedTransfer: transfer
        ? { ...transfer, ...stats }
        : prev.selectedTransfer,
    }));
  };

  const handleReceipt = (transferId: string) => {
    setState((prev) => ({
      ...prev,
      receiptModal: { open: true, transferId },
    }));
  };

  const handleAccept = (transferId: string) => {
    setState((prev) => ({
      ...prev,
      acceptModal: { open: true, transferId },
    }));
  };

  const handleReject = (transferId: string) => {
    setState((prev) => ({
      ...prev,
      rejectModal: { open: true, transferId },
    }));
  };

  const handleCancel = (transferId: string) => {
    setState((prev) => ({
      ...prev,
      cancelModal: { open: true, transferId },
    }));
  };

  const triggerRefresh = () => {
    setState((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 }));
  };

  const handleCreateSuccess = () => {
    setState((prev) => ({
      ...prev,
      createModal: { ...prev.createModal, open: false },
    }));
    triggerRefresh();
  };

  const handleWorkflowSuccess = () => {
    triggerRefresh();
    handleBackToList();
  };

  if (!branchId) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const isDetailView = state.view === "detail" && state.selectedTransferId;

  return (
    <div className="space-y-6">
      {isDetailView ? (
        <TransferDetailView
          transferId={state.selectedTransferId}
          onBack={handleBackToList}
          onDispatch={handleDispatch}
          onReceipt={handleReceipt}
          onAccept={handleAccept}
          onReject={handleReject}
          onCancel={handleCancel}
        />
      ) : (
        <>
          <Tabs
          defaultValue={isSuperAdmin ? "hq" : "branch"}
          value={state.activeTab}
          onValueChange={(value) =>
            setState((prev) => ({ ...prev, activeTab: value as "hq" | "branch" }))
          }
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            {isSuperAdmin && <TabsTrigger value="hq">HQ Supplies</TabsTrigger>}
            <TabsTrigger value="branch">Branch Transfers</TabsTrigger>
          </TabsList>

          {isSuperAdmin && (
            <TabsContent value="hq">
              <HQSuppliesPage
                branchId={branchId}
                refreshKey={state.refreshKey}
                onCreateClick={handleCreateSupply}
                onViewClick={handleViewTransfer}
              />
            </TabsContent>
          )}

          <TabsContent value="branch">
            <BranchTransfersPage
              branchId={branchId}
              refreshKey={state.refreshKey}
              onCreateClick={handleCreateTransfer}
              onViewClick={handleViewTransfer}
            />
          </TabsContent>
        </Tabs>
        </>
      )}

      {/* Create Transfer Modal */}
      <CreateTransferModal
        open={state.createModal.open}
        onOpenChange={(open) =>
          setState((prev) => ({
            ...prev,
            createModal: { ...prev.createModal, open },
          }))
        }
        transferType={state.createModal.type}
        sourceBranchId={branchId}
        onSuccess={handleCreateSuccess}
      />

      {/* Dispatch Modal */}
      {state.dispatchModal.transferId && state.selectedTransfer && (
        <DispatchTransferModal
          open={state.dispatchModal.open}
          onOpenChange={(open) =>
            setState((prev) => ({
              ...prev,
              dispatchModal: { open },
            }))
          }
          transferId={state.dispatchModal.transferId}
          transferNumber={state.selectedTransfer.transferNumber}
          itemCount={state.selectedTransfer.itemCount ?? 0}
          totalQuantity={state.selectedTransfer.totalQuantity ?? 0}
          totalValue={state.selectedTransfer.totalValue ?? 0}
          onSuccess={handleWorkflowSuccess}
        />
      )}

      {/* Receipt Modal */}
      {state.receiptModal.transferId && (
        <ConfirmReceiptModal
          open={state.receiptModal.open}
          onOpenChange={(open) =>
            setState((prev) => ({
              ...prev,
              receiptModal: { open },
            }))
          }
          transferId={state.receiptModal.transferId}
          transferNumber={state.selectedTransfer?.transferNumber || ""}
          onSuccess={handleWorkflowSuccess}
        />
      )}

      {/* Accept Modal */}
      {state.acceptModal.transferId && (
        <AcceptTransferModal
          open={state.acceptModal.open}
          onOpenChange={(open) =>
            setState((prev) => ({
              ...prev,
              acceptModal: { open },
            }))
          }
          transferId={state.acceptModal.transferId}
          transferNumber={state.selectedTransfer?.transferNumber || ""}
          sourceBranch={state.selectedTransfer?.sourceBranchId || ""}
          onSuccess={handleWorkflowSuccess}
        />
      )}

      {/* Reject Modal */}
      {state.rejectModal.transferId && (
        <RejectTransferModal
          open={state.rejectModal.open}
          onOpenChange={(open) =>
            setState((prev) => ({
              ...prev,
              rejectModal: { open },
            }))
          }
          transferId={state.rejectModal.transferId}
          transferNumber={state.selectedTransfer?.transferNumber || ""}
          sourceBranch={state.selectedTransfer?.sourceBranchId || ""}
          onSuccess={handleWorkflowSuccess}
        />
      )}

      {state.cancelModal.transferId && (
        <CancelTransferModal
          open={state.cancelModal.open}
          onOpenChange={(open) =>
            setState((prev) => ({
              ...prev,
              cancelModal: { open },
            }))
          }
          transferId={state.cancelModal.transferId}
          transferNumber={state.selectedTransfer?.transferNumber || ""}
          onSuccess={handleWorkflowSuccess}
        />
      )}
    </div>
  );
}
