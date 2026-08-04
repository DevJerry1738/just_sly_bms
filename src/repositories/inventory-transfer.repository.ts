import { BaseRepository } from "./base.repository";
import { db, type InventoryTransferSchema, type TransferStatus, type InventoryTransferItemSchema } from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// Transfer number generator: TRF-YYYYMMDD-XXXX
// ---------------------------------------------------------------------------

async function generateTransferNumber(): Promise<string> {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await db.inventory_transfers.count();
  return `TRF-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// InventoryTransferRepository
// ---------------------------------------------------------------------------

export interface CreateTransferInput {
  transferType: "hq_supply" | "branch_transfer";
  sourceBranchId: string;
  destinationBranchId: string;
  createdBy: string;
  notes?: string;
  referenceDocumentNumber?: string;
  expectedArrivalDate?: string;
}

export interface CreateTransferItemInput {
  productId: string;
  packagingUnit?: string;
  quantityInPackaging: number;
  convertedBaseQuantity: number;
  unitCostSnapshot: number;
  batchId?: string;
  notes?: string;
}

export class InventoryTransferRepository extends BaseRepository<InventoryTransferSchema> {
  constructor() {
    super("inventory_transfers", db.inventory_transfers);
  }

  /**
   * Create a new transfer document.
   */
  async createTransfer(input: CreateTransferInput): Promise<InventoryTransferSchema> {
    const now = Date.now();
    const transfer: InventoryTransferSchema = {
      id: crypto.randomUUID(),
      transferNumber: await generateTransferNumber(),
      transferType: input.transferType,
      sourceBranchId: input.sourceBranchId,
      destinationBranchId: input.destinationBranchId,
      createdBy: input.createdBy,
      status: "draft",
      notes: input.notes,
      referenceDocumentNumber: input.referenceDocumentNumber,
      expectedArrivalDate: input.expectedArrivalDate,
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    await db.inventory_transfers.put(transfer);
    await SyncQueueService.enqueue(
      "inventory_transfers",
      "CREATE",
      transfer as unknown as Record<string, unknown>,
      { branchId: input.sourceBranchId }
    );
    await DomainEvents.publish("TRANSFER_CREATED", {
      entity: "InventoryTransfer",
      entityId: transfer.id,
      record: transfer,
    });

    return transfer;
  }

  /**
   * Get transfer by transfer number.
   */
  async getByTransferNumber(number: string): Promise<InventoryTransferSchema | undefined> {
    return db.inventory_transfers.where("transferNumber").equals(number).first();
  }

  /**
   * Get all transfers for a branch (as source or destination).
   */
  async getByBranch(
    branchId: string,
    direction: "source" | "destination" | "all" = "all"
  ): Promise<InventoryTransferSchema[]> {
    let transfers = await db.inventory_transfers.toArray();

    if (direction === "source") {
      transfers = transfers.filter((t) => t.sourceBranchId === branchId);
    } else if (direction === "destination") {
      transfers = transfers.filter((t) => t.destinationBranchId === branchId);
    } else {
      transfers = transfers.filter(
        (t) => t.sourceBranchId === branchId || t.destinationBranchId === branchId
      );
    }

    return transfers.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all transfers with a given status.
   */
  async getByStatus(status: TransferStatus): Promise<InventoryTransferSchema[]> {
    return db.inventory_transfers
      .where("status")
      .equals(status)
      .reverse()
      .sortBy("createdAt");
  }

  /**
   * Get pending receipts for a branch (destination waiting to confirm receipt).
   */
  async getPendingReceipts(branchId: string): Promise<InventoryTransferSchema[]> {
    const transfers = await db.inventory_transfers.toArray();
    return transfers.filter(
      (t) => t.destinationBranchId === branchId && t.status === "pending_receipt"
    );
  }

  /**
   * Update transfer status and timestamp.
   */
  async updateStatus(
    transferId: string,
    newStatus: TransferStatus,
    metadata?: {
      dispatchedAt?: number;
      receivedAt?: number;
      rejectedAt?: number;
      cancelledAt?: number;
    }
  ): Promise<InventoryTransferSchema> {
    const existing = await this.getById(transferId);
    if (!existing) {
      throw new Error(`[Repository] InventoryTransfer with id "${transferId}" not found`);
    }

    const updated: InventoryTransferSchema = {
      ...existing,
      status: newStatus,
      dispatchedAt: metadata?.dispatchedAt ?? existing.dispatchedAt,
      receivedAt: metadata?.receivedAt ?? existing.receivedAt,
      rejectedAt: metadata?.rejectedAt ?? existing.rejectedAt,
      cancelledAt: metadata?.cancelledAt ?? existing.cancelledAt,
      updatedAt: Date.now(),
      sync_status: "pending",
    };

    await db.inventory_transfers.put(updated);
    await SyncQueueService.enqueue(
      "inventory_transfers",
      "UPDATE",
      updated as unknown as Record<string, unknown>,
      { branchId: existing.sourceBranchId }
    );
    await DomainEvents.publish("TRANSFER_STATUS_CHANGED", {
      entity: "InventoryTransfer",
      entityId: transferId,
      fromStatus: existing.status,
      toStatus: newStatus,
      record: updated,
    });

    return updated;
  }

  /**
   * Get transfer with all its items.
   */
  async getTransferWithItems(transferId: string): Promise<{
    transfer: InventoryTransferSchema | undefined;
    items: InventoryTransferItemSchema[];
  }> {
    const transfer = await this.getById(transferId);
    const items = await db.inventory_transfer_items.where("transferId").equals(transferId).toArray();

    return { transfer, items };
  }

  /**
   * Get total value of transfer (for cost tracking).
   */
  async getTransferValue(transferId: string): Promise<number> {
    const items = await db.inventory_transfer_items.where("transferId").equals(transferId).toArray();
    return items.reduce((sum, item) => sum + item.convertedBaseQuantity * item.unitCostSnapshot, 0);
  }

  /**
   * Get transfer with full statistics.
   */
  async getTransferStats(transferId: string): Promise<{
    transfer: InventoryTransferSchema | undefined;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    const transfer = await this.getById(transferId);
    const items = await db.inventory_transfer_items.where("transferId").equals(transferId).toArray();

    const totalQuantity = items.reduce((sum, item) => sum + item.convertedBaseQuantity, 0);
    const totalValue = items.reduce(
      (sum, item) => sum + item.convertedBaseQuantity * item.unitCostSnapshot,
      0
    );

    return {
      transfer,
      itemCount: items.length,
      totalQuantity,
      totalValue,
    };
  }
}

export const inventoryTransferRepository = new InventoryTransferRepository();
