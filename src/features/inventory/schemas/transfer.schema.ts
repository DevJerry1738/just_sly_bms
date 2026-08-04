import { z } from "zod";

// ---------------------------------------------------------------------------
// Transfer Creation & Management
// ---------------------------------------------------------------------------

export const CreateTransferInputSchema = z.object({
  transferType: z.enum(["hq_supply", "branch_transfer"]),
  sourceBranchId: z.string().min(1, "Source branch is required"),
  destinationBranchId: z.string().min(1, "Destination branch is required"),
  notes: z.string().optional(),
  referenceDocumentNumber: z.string().optional(),
  expectedArrivalDate: z.string().datetime().optional(),
});

export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const CreateTransferItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  packagingUnit: z.string().optional(),
  quantityInPackaging: z.number().positive("Quantity must be positive"),
  convertedBaseQuantity: z.number().positive("Base quantity must be positive"),
  unitCostSnapshot: z.number().nonnegative("Unit cost must be non-negative"),
  batchId: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateTransferItem = z.infer<typeof CreateTransferItemSchema>;

export const CreateTransferWithItemsSchema = z.object({
  transfer: CreateTransferInputSchema,
  items: z.array(CreateTransferItemSchema).min(1, "At least one item is required"),
});

export type CreateTransferWithItems = z.infer<typeof CreateTransferWithItemsSchema>;

// ---------------------------------------------------------------------------
// Dispatch Transfer
// ---------------------------------------------------------------------------

export const DispatchTransferSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
  dispatchedAt: z.number().optional(),
});

export type DispatchTransfer = z.infer<typeof DispatchTransferSchema>;

// ---------------------------------------------------------------------------
// Receive Transfer
// ---------------------------------------------------------------------------

export const ReceiveTransferSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
  receivedQuantities: z.record(z.string(), z.number().nonnegative()).optional(),
  receivedAt: z.number().optional(),
});

export type ReceiveTransfer = z.infer<typeof ReceiveTransferSchema>;

// ---------------------------------------------------------------------------
// Reject Transfer
// ---------------------------------------------------------------------------

export const RejectTransferSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
  reason: z.string().min(1, "Reason is required"),
  rejectedAt: z.number().optional(),
});

export type RejectTransfer = z.infer<typeof RejectTransferSchema>;

// ---------------------------------------------------------------------------
// Cancel Transfer
// ---------------------------------------------------------------------------

export const CancelTransferSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
  reason: z.string().min(1, "Reason is required"),
  cancelledAt: z.number().optional(),
});

export type CancelTransfer = z.infer<typeof CancelTransferSchema>;

// ---------------------------------------------------------------------------
// Update Transfer
// ---------------------------------------------------------------------------

export const UpdateTransferSchema = z.object({
  transferId: z.string().min(1, "Transfer ID is required"),
  notes: z.string().optional(),
  expectedArrivalDate: z.string().datetime().optional(),
  referenceDocumentNumber: z.string().optional(),
});

export type UpdateTransfer = z.infer<typeof UpdateTransferSchema>;
