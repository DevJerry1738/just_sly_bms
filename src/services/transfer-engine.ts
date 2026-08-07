import {
  inventoryTransferRepository,
  type CreateTransferInput,
  type CreateTransferItemInput,
} from "@/repositories/inventory-transfer.repository";
import { inventoryReservationRepository } from "@/repositories/inventory-reservation.repository";
import { transferStatusHistoryRepository } from "@/repositories/transfer-status-history.repository";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { transferNotificationService } from "./transfer-notifications";
import { db, type InventoryTransferSchema, type TransferStatus } from "@/database/schema";

// ---------------------------------------------------------------------------
// Validation Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TransferItem {
  productId: string;
  packagingUnit?: string;
  quantityInPackaging: number;
  convertedBaseQuantity: number;
  unitCostSnapshot: number;
  batchId?: string;
}

// ---------------------------------------------------------------------------
// InventoryTransferEngine
// ---------------------------------------------------------------------------

export class InventoryTransferEngine {
  /**
   * Validate transfer creation input.
   */
  async validateTransferCreation(input: CreateTransferInput): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!input.sourceBranchId) errors.push("Source branch is required");
    if (!input.destinationBranchId) errors.push("Destination branch is required");
    if (input.sourceBranchId === input.destinationBranchId) {
      errors.push("Source and destination branches cannot be the same");
    }
    if (!input.createdBy) errors.push("Created by user ID is required");

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate that items can be transferred (stock availability, etc).
   */
  async validateItemsForTransfer(
    items: TransferItem[],
    sourceBranchId: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    if (items.length === 0) {
      errors.push("At least one item is required");
    }

    console.log(`[TransferEngine] Validating ${items.length} items for source branch ${sourceBranchId}`);

    for (const item of items) {
      if (!item.productId) errors.push("Product ID is required for all items");
      if (item.convertedBaseQuantity <= 0) {
        errors.push(`Item quantity must be positive: ${item.productId}`);
      }

      // Check available stock
      const available = await inventoryReservationRepository.getAvailableQuantity(
        item.productId,
        sourceBranchId
      );
      console.log(
        `[TransferEngine] Stock check for ${item.productId}: requested=${item.convertedBaseQuantity}, available=${available}`
      );
      
      if (available < item.convertedBaseQuantity) {
        errors.push(
          `Insufficient stock for ${item.productId}: requested ${item.convertedBaseQuantity}, available ${available}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new transfer with items and reserve stock.
   */
  async createTransfer(
    input: CreateTransferInput,
    items: CreateTransferItemInput[]
  ): Promise<InventoryTransferSchema> {
    console.log("[TransferEngine] createTransfer called with:", {
      transferType: input.transferType,
      sourceBranchId: input.sourceBranchId,
      destinationBranchId: input.destinationBranchId,
      itemCount: items.length,
    });

    // Validate inputs
    const transferValidation = await this.validateTransferCreation(input);
    if (!transferValidation.valid) {
      throw new Error(`Transfer validation failed: ${transferValidation.errors.join(", ")}`);
    }

    const itemsValidation = await this.validateItemsForTransfer(
      items as TransferItem[],
      input.sourceBranchId
    );
    if (!itemsValidation.valid) {
      throw new Error(`Items validation failed: ${itemsValidation.errors.join(", ")}`);
    }

    // Create transfer document
    const transfer = await inventoryTransferRepository.createTransfer(input);

    // Add items to transfer
    for (const item of items) {
      const transferItem = {
        id: crypto.randomUUID(),
        transferId: transfer.id,
        ...item,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.inventory_transfer_items.put(transferItem);

      // Allocate batches if product has expiry tracking
      if (item.batchId) {
        await this.allocateBatches(
          transferItem.id,
          item.convertedBaseQuantity,
          item.productId,
          input.sourceBranchId
        );
      }
    }

    // Reserve stock for all items
    for (const item of items) {
      await inventoryReservationRepository.reserve(
        item.productId,
        input.sourceBranchId,
        item.convertedBaseQuantity,
        transfer.id,
        "base"
      );
    }

    // Record initial status in history
    await transferStatusHistoryRepository.recordStatusChange(
      transfer.id,
      "draft",
      input.createdBy,
      undefined,
      "Transfer created"
    );

    // Audit log
    await auditLogRepository.create({
      id: crypto.randomUUID(),
      userId: input.createdBy,
      branchId: input.sourceBranchId,
      entity: "InventoryTransfer",
      entityId: transfer.id,
      action: "TRANSFER_CREATED",
      after: { transferNumber: transfer.transferNumber, status: transfer.status },
      timestamp: Date.now(),
      synced: false,
    });

    // Notify branch staff that a transfer has been created
    await transferNotificationService.notifyTransferCreated(transfer);

    return transfer;
  }

  /**
   * Allocate batches to a transfer item (FIFO by expiry).
   */
  async allocateBatches(
    transferItemId: string,
    quantity: number,
    productId: string,
    branchId: string
  ): Promise<void> {
    const batches = await inventoryBatchRepository.getBatchesForProduct(productId, branchId);

    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const allocateQty = Math.min(remaining, batch.quantityOnHand);

      if (allocateQty > 0) {
        const allocation = {
          id: crypto.randomUUID(),
          transferItemId,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          manufactureDate: batch.manufactureDate,
          expiryDate: batch.expiryDate,
          quantityAllocated: allocateQty,
          createdAt: Date.now(),
        };

        await db.inventory_transfer_batches.put(allocation);
        remaining -= allocateQty;
      }
    }

    if (remaining > 0) {
      throw new Error(
        `Could not fully allocate batches: ${remaining} units remaining after FIFO allocation`
      );
    }
  }

  /**
   * Dispatch a transfer and mark it as pending receipt.
   * Stock is already reserved; this deducts it from on-hand.
   */
  async dispatchTransfer(
    transferId: string,
    dispatchedBy: string,
    dispatchedAt: number = Date.now()
  ): Promise<InventoryTransferSchema> {
    const transfer = await inventoryTransferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (transfer.status !== "draft" && transfer.status !== "pending_dispatch") {
      throw new Error(`Cannot dispatch transfer with status: ${transfer.status}`);
    }

    // Get transfer items
    const { items } = await inventoryTransferRepository.getTransferWithItems(transferId);
    if (items.length === 0) {
      throw new Error("Cannot dispatch transfer with no items");
    }

    // Create inventory transactions for each allocated batch (HQ out)
    for (const item of items) {
      const allocations = await db.inventory_transfer_batches
        .where("transferItemId")
        .equals(item.id)
        .toArray();

      if (allocations.length > 0) {
        for (const allocation of allocations) {
          await inventoryTransactionRepository.recordTransaction({
            type: "branch_transfer_out",
            productId: item.productId,
            branchId: transfer.sourceBranchId,
            quantity: -allocation.quantityAllocated,
            baseUnit: "base",
            unitCost: item.unitCostSnapshot,
            batchId: allocation.batchId ?? null,
            notes: `Dispatch transfer ${transfer.transferNumber}`,
            performedBy: dispatchedBy,
            performedByName: "",
          });
        }
      } else {
        await inventoryTransactionRepository.recordTransaction({
          type: "branch_transfer_out",
          productId: item.productId,
          branchId: transfer.sourceBranchId,
          quantity: -item.convertedBaseQuantity,
          baseUnit: "base",
          unitCost: item.unitCostSnapshot,
          batchId: item.batchId ?? null,
          notes: `Dispatch transfer ${transfer.transferNumber}`,
          performedBy: dispatchedBy,
          performedByName: "",
        });
      }
    }

    // Update transfer status to pending receipt
    const updated = await inventoryTransferRepository.updateStatus(
      transferId,
      "pending_receipt",
      { dispatchedAt }
    );

    // Record status change
    await transferStatusHistoryRepository.recordStatusChange(
      transferId,
      "pending_receipt",
      dispatchedBy,
      transfer.status,
      "Transfer dispatched"
    );

    // Audit log
    await auditLogRepository.create({
      id: crypto.randomUUID(),
      userId: dispatchedBy,
      branchId: transfer.sourceBranchId,
      entity: "InventoryTransfer",
      entityId: transferId,
      action: "TRANSFER_DISPATCHED",
      after: { status: "pending_receipt", dispatchedAt },
      timestamp: Date.now(),
      synced: false,
    });

    // Notify destination branch staff the transfer is pending receipt
    await transferNotificationService.notifyTransferPendingReceipt(updated);

    return updated;
  }

  /**
   * Confirm receipt of transfer (increase destination inventory).
   */
  async receiveTransfer(
    transferId: string,
    receivedBy: string,
    receivedQuantities?: Record<string, number>,
    receivedAt: number = Date.now()
  ): Promise<InventoryTransferSchema> {
    const transfer = await inventoryTransferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (
      transfer.status !== "dispatched" &&
      transfer.status !== "in_transit" &&
      transfer.status !== "pending_receipt"
    ) {
      throw new Error(`Cannot receive transfer with status: ${transfer.status}`);
    }

    // Get transfer items
    const { items } = await inventoryTransferRepository.getTransferWithItems(transferId);

    // Create inventory transactions for destination branch
    for (const item of items) {
      const qty = receivedQuantities?.[item.id] ?? item.convertedBaseQuantity;

      if (qty > 0) {
        const batch = await inventoryBatchRepository.createBatch({
          productId: item.productId,
          branchId: transfer.destinationBranchId,
          initialQuantity: qty,
          quantityOnHand: qty,
          manufactureDate: item.manufactureDate || undefined,
          expiryDate: item.expiryDate || undefined,
          unitCost: item.unitCostSnapshot,
          notes: `Receipt transfer ${transfer.transferNumber}`,
          createdBy: receivedBy,
        });

        // Destination: Increase inventory (positive quantity)
        await inventoryTransactionRepository.recordTransaction({
          type: "branch_transfer_in",
          productId: item.productId,
          branchId: transfer.destinationBranchId,
          quantity: qty,
          baseUnit: "base",
          unitCost: item.unitCostSnapshot,
          batchId: batch.id,
          notes: `Receipt transfer ${transfer.transferNumber}`,
          performedBy: receivedBy,
          performedByName: "",
        });
      }
    }

    // Release reservations
    await inventoryReservationRepository.releaseByTransfer(transferId);

    // Update transfer status
    const updated = await inventoryTransferRepository.updateStatus(
      transferId,
      "received",
      { receivedAt }
    );

    // Record status change
    await transferStatusHistoryRepository.recordStatusChange(
      transferId,
      "received",
      receivedBy,
      transfer.status,
      "Transfer received"
    );

    // Audit log
    await auditLogRepository.create({
      id: crypto.randomUUID(),
      userId: receivedBy,
      branchId: transfer.destinationBranchId,
      entity: "InventoryTransfer",
      entityId: transferId,
      action: "TRANSFER_RECEIVED",
      after: { status: "received", receivedAt },
      timestamp: Date.now(),
      synced: false,
    });

    await transferNotificationService.notifyTransferReceived(updated);

    return updated;
  }

  /**
   * Reject transfer (release reservations, return to draft status for rework).
   */
  async rejectTransfer(
    transferId: string,
    rejectedBy: string,
    reason: string,
    rejectedAt: number = Date.now()
  ): Promise<InventoryTransferSchema> {
    const transfer = await inventoryTransferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (
      transfer.status !== "pending_receipt" &&
      transfer.status !== "dispatched" &&
      transfer.status !== "draft"
    ) {
      throw new Error(`Cannot reject transfer with status: ${transfer.status}`);
    }

    // Release all reservations
    await inventoryReservationRepository.releaseByTransfer(transferId);

    // Update transfer status
    const updated = await inventoryTransferRepository.updateStatus(
      transferId,
      "rejected",
      { rejectedAt }
    );

    // Record status change
    await transferStatusHistoryRepository.recordStatusChange(
      transferId,
      "rejected",
      rejectedBy,
      transfer.status,
      reason
    );

    // Audit log
    await auditLogRepository.create({
      id: crypto.randomUUID(),
      userId: rejectedBy,
      branchId: transfer.destinationBranchId,
      entity: "InventoryTransfer",
      entityId: transferId,
      action: "TRANSFER_REJECTED",
      after: { status: "rejected", reason, rejectedAt },
      timestamp: Date.now(),
      synced: false,
    });

    await transferNotificationService.notifyTransferRejected(updated, reason);

    return updated;
  }

  /**
   * Cancel transfer (release reservations).
   * Only allowed for draft/pending status.
   */
  async cancelTransfer(
    transferId: string,
    cancelledBy: string,
    reason: string,
    cancelledAt: number = Date.now()
  ): Promise<InventoryTransferSchema> {
    const transfer = await inventoryTransferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (transfer.status !== "draft" && transfer.status !== "pending_dispatch") {
      throw new Error(
        `Cannot cancel transfer with status: ${transfer.status}. Only draft/pending_dispatch transfers can be cancelled.`
      );
    }

    // Release all reservations
    await inventoryReservationRepository.releaseByTransfer(transferId);

    // Update transfer status
    const updated = await inventoryTransferRepository.updateStatus(
      transferId,
      "cancelled",
      { cancelledAt }
    );

    // Record status change
    await transferStatusHistoryRepository.recordStatusChange(
      transferId,
      "cancelled",
      cancelledBy,
      transfer.status,
      reason
    );

    // Audit log
    await auditLogRepository.create({
      id: crypto.randomUUID(),
      userId: cancelledBy,
      branchId: transfer.sourceBranchId,
      entity: "InventoryTransfer",
      entityId: transferId,
      action: "TRANSFER_CANCELLED",
      after: { status: "cancelled", reason, cancelledAt },
      timestamp: Date.now(),
      synced: false,
    });

    await transferNotificationService.notifyTransferCancelled(updated, reason);

    return updated;
  }

  /**
   * Get time from creation to status (for metrics).
   */
  async getTransferMetrics(transferId: string): Promise<{
    totalTime: number;
    timeToDispatch?: number;
    timeToReceipt?: number;
  }> {
    const transfer = await inventoryTransferRepository.getById(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    const now = Date.now();
    const totalTime = now - transfer.createdAt;

    let timeToDispatch: number | undefined;
    let timeToReceipt: number | undefined;

    if (transfer.dispatchedAt) {
      timeToDispatch = transfer.dispatchedAt - transfer.createdAt;
    }

    if (transfer.receivedAt) {
      timeToReceipt = transfer.receivedAt - transfer.createdAt;
    }

    return { totalTime, timeToDispatch, timeToReceipt };
  }
}

export const inventoryTransferEngine = new InventoryTransferEngine();
