import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CreateTransferWithItemsSchema,
  DispatchTransferSchema,
  ReceiveTransferSchema,
  RejectTransferSchema,
  CancelTransferSchema,
} from "./schemas/transfer.schema";
import { inventoryTransferEngine } from "@/services/transfer-engine";
import { inventoryTransferRepository } from "@/repositories/inventory-transfer.repository";

// ---------------------------------------------------------------------------
// Create Transfer
// ---------------------------------------------------------------------------

export const createTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(CreateTransferWithItemsSchema)
  .handler(async (ctx) => {
    try {
      const { transfer: transferInput, items } = ctx.data;
      const user = ctx.context.user;

      const transfer = await inventoryTransferEngine.createTransfer(
        {
          ...transferInput,
          createdBy: user.id,
        },
        items
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

export const dispatchTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(DispatchTransferSchema)
  .handler(async (ctx) => {
    try {
      const { transferId, dispatchedAt } = ctx.data;
      const user = ctx.context.user;

      const transfer = await inventoryTransferEngine.dispatchTransfer(
        transferId,
        user.id,
        dispatchedAt
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

export const receiveTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(ReceiveTransferSchema)
  .handler(async (ctx) => {
    try {
      const { transferId, receivedQuantities, receivedAt } = ctx.data;
      const user = ctx.context.user;

      const transfer = await inventoryTransferEngine.receiveTransfer(
        transferId,
        user.id,
        receivedQuantities,
        receivedAt
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

export const rejectTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(RejectTransferSchema)
  .handler(async (ctx) => {
    try {
      const { transferId, reason, rejectedAt } = ctx.data;
      const user = ctx.context.user;

      const transfer = await inventoryTransferEngine.rejectTransfer(
        transferId,
        user.id,
        reason,
        rejectedAt
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

export const cancelTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(CancelTransferSchema)
  .handler(async (ctx) => {
    try {
      const { transferId, reason, cancelledAt } = ctx.data;
      const user = ctx.context.user;

      const transfer = await inventoryTransferEngine.cancelTransfer(
        transferId,
        user.id,
        reason,
        cancelledAt
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

export const getTransfer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ transferId: z.string() }))
  .handler(async (ctx) => {
    try {
      const { transferId } = ctx.data;

      const { transfer, items } = await inventoryTransferRepository.getTransferWithItems(
        transferId
      );
      const stats = await inventoryTransferRepository.getTransferStats(transferId);

      return {
        success: true,
        data: {
          transfer,
          items,
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

export const listBranchTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      branchId: z.string(),
      direction: z.enum(["source", "destination", "all"]).optional(),
    })
  )
  .handler(async (ctx) => {
    try {
      const { branchId, direction } = ctx.data;

      const transfers = await inventoryTransferRepository.getByBranch(
        branchId,
        direction || "all"
      );

      return {
        success: true,
        data: transfers,
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

export const getPendingReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ branchId: z.string() }))
  .handler(async (ctx) => {
    try {
      const { branchId } = ctx.data;

      const transfers = await inventoryTransferRepository.getPendingReceipts(branchId);

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
