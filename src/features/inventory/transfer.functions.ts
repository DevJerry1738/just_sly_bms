import { createClientOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CreateTransferWithItemsSchema,
  DispatchTransferSchema,
  ReceiveTransferSchema,
  RejectTransferSchema,
  CancelTransferSchema,
} from "./schemas/transfer.schema";
import { inventoryTransferEngine } from "@/services/transfer-engine";
import { inventoryTransferRepository } from "@/repositories/inventory-transfer.repository";
import { branchRepository } from "@/repositories/branch.repository";
import { productRepository } from "@/repositories/product.repository";
import { supabase } from "@/integrations/supabase/client";

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (!userId || error) {
    throw new Error("Unauthorized: User must be signed in");
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Create Transfer
// ---------------------------------------------------------------------------

export const createTransfer = createClientOnlyFn(async (opts: {
  data: z.infer<typeof CreateTransferWithItemsSchema>;
}) => {
  try {
    const validated = CreateTransferWithItemsSchema.parse(opts.data);
    const userId = await getCurrentUserId();

    const transfer = await inventoryTransferEngine.createTransfer(
      {
        ...validated.transfer,
        createdBy: userId,
      },
      validated.items
    );

    return {
      success: true,
      data: transfer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Dispatch Transfer (HQ Supply or Branch Transfer)
// ---------------------------------------------------------------------------

export const dispatchTransfer = createClientOnlyFn(async (opts: {
  transferId: string;
  dispatchedAt?: number;
}) => {
  try {
    const validated = DispatchTransferSchema.parse(opts);
    const userId = await getCurrentUserId();

    const transfer = await inventoryTransferEngine.dispatchTransfer(
      validated.transferId,
      userId,
      validated.dispatchedAt
    );

    return {
      success: true,
      data: transfer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Receive Transfer (Confirm Receipt)
// ---------------------------------------------------------------------------

export const receiveTransfer = createClientOnlyFn(async (opts: {
  transferId: string;
  receivedQuantities?: Record<string, number>;
  receivedAt?: number;
}) => {
  try {
    const validated = ReceiveTransferSchema.parse(opts);
    const userId = await getCurrentUserId();

    const transfer = await inventoryTransferEngine.receiveTransfer(
      validated.transferId,
      userId,
      validated.receivedQuantities,
      validated.receivedAt
    );

    return {
      success: true,
      data: transfer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to receive transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Reject Transfer
// ---------------------------------------------------------------------------

export const rejectTransfer = createClientOnlyFn(async (opts: {
  transferId: string;
  reason: string;
  rejectedAt?: number;
}) => {
  try {
    const validated = RejectTransferSchema.parse(opts);
    const userId = await getCurrentUserId();

    const transfer = await inventoryTransferEngine.rejectTransfer(
      validated.transferId,
      userId,
      validated.reason,
      validated.rejectedAt
    );

    return {
      success: true,
      data: transfer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Cancel Transfer
// ---------------------------------------------------------------------------

export const cancelTransfer = createClientOnlyFn(async (opts: {
  transferId: string;
  reason: string;
  cancelledAt?: number;
}) => {
  try {
    const validated = CancelTransferSchema.parse(opts);
    const userId = await getCurrentUserId();

    const transfer = await inventoryTransferEngine.cancelTransfer(
      validated.transferId,
      userId,
      validated.reason,
      validated.cancelledAt
    );

    return {
      success: true,
      data: transfer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Get Transfer Details
// ---------------------------------------------------------------------------

export const getTransfer = createClientOnlyFn(async (opts: { transferId: string }) => {
  try {
    const validated = z.object({ transferId: z.string() }).parse(opts);

    const { transfer, items } = await inventoryTransferRepository.getTransferWithItems(
      validated.transferId
    );
    const stats = await inventoryTransferRepository.getTransferStats(validated.transferId);

    const sourceBranch = transfer
      ? await branchRepository.getById(transfer.sourceBranchId)
      : null;
    const destinationBranch = transfer
      ? await branchRepository.getById(transfer.destinationBranchId)
      : null;

    const productRecords = await Promise.all(
      items.map((item) => productRepository.getById(item.productId))
    );

    const enrichedItems = items.map((item, index) => ({
      ...item,
      productName: productRecords[index]?.name ?? item.productId,
    }));

    return {
      success: true,
      data: {
        transfer: transfer
          ? {
              ...transfer,
              sourceBranchName:
                sourceBranch?.name || sourceBranch?.code || transfer.sourceBranchId,
              destinationBranchName:
                destinationBranch?.name || destinationBranch?.code || transfer.destinationBranchId,
            }
          : undefined,
        items: enrichedItems,
        stats: {
          itemCount: stats.itemCount,
          totalQuantity: stats.totalQuantity,
          totalValue: stats.totalValue,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch transfer";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// List Transfers for Branch
// ---------------------------------------------------------------------------

export const listBranchTransfers = createClientOnlyFn(async (opts: {
  branchId: string;
  direction?: "source" | "destination" | "all";
}) => {
  try {
    const validated = z.object({
      branchId: z.string(),
      direction: z.enum(["source", "destination", "all"]).optional(),
    }).parse(opts);

    const transfers = await inventoryTransferRepository.getByBranch(
      validated.branchId,
      validated.direction || "all"
    );

    const branchIds = Array.from(
      new Set(
        transfers.flatMap((transfer) => [transfer.sourceBranchId, transfer.destinationBranchId])
      )
    );

    const branches = await Promise.all(
      branchIds.map((branchId) => branchRepository.getById(branchId))
    );
    const branchMap = new Map(branches.filter(Boolean).map((branch) => [branch!.id, branch!]));

    const enrichedTransfers = await Promise.all(
      transfers.map(async (transfer) => {
        const stats = await inventoryTransferRepository.getTransferStats(transfer.id);
        return {
          ...transfer,
          itemCount: stats.itemCount,
          sourceBranchName:
            branchMap.get(transfer.sourceBranchId)?.name || transfer.sourceBranchId,
          destinationBranchName:
            branchMap.get(transfer.destinationBranchId)?.name || transfer.destinationBranchId,
        };
      })
    );

    return {
      success: true,
      data: enrichedTransfers,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list transfers";
    return {
      success: false,
      error: message,
    };
  }
});

// ---------------------------------------------------------------------------
// Get Pending Receipts
// ---------------------------------------------------------------------------

export const getPendingReceipts = createClientOnlyFn(async (opts: { branchId: string }) => {
  try {
    const validated = z.object({ branchId: z.string() }).parse(opts);

    const transfers = await inventoryTransferRepository.getPendingReceipts(validated.branchId);

    return {
      success: true,
      data: transfers,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch pending receipts";
    return {
      success: false,
      error: message,
    };
  }
});
