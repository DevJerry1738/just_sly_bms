import { BaseRepository } from "./base.repository";
import { db } from "@/database/schema";
import type { InventoryBatchSchema } from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// Batch number generator: BAT-YYYYMMDD-XXXX
// ---------------------------------------------------------------------------
async function generateBatchNumber(): Promise<string> {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await db.inventory_batches.count();
  return `BAT-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export class InventoryBatchRepository extends BaseRepository<InventoryBatchSchema> {
  constructor() {
    super("inventory_batches", db.inventory_batches);
  }

  async createBatch(
    data: Omit<
      InventoryBatchSchema,
      "id" | "batchNumber" | "status" | "createdAt" | "updatedAt" | "sync_status"
    >
  ): Promise<InventoryBatchSchema> {
    const now = Date.now();
    const batch: InventoryBatchSchema = {
      id: crypto.randomUUID(),
      batchNumber: await generateBatchNumber(),
      ...data,
      status: "active",
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };
    await db.inventory_batches.put(batch);
    await SyncQueueService.enqueue(
      "inventory_batches",
      "CREATE",
      batch as unknown as Record<string, unknown>,
      { branchId: data.branchId }
    );
    await DomainEvents.publish("BATCH_CREATED", {
      entity: "InventoryBatch",
      entityId: batch.id,
      record: batch,
    });
    return batch;
  }

  async getBatchesForProduct(
    productId: string,
    branchId?: string
  ): Promise<InventoryBatchSchema[]> {
    let results = await db.inventory_batches
      .where("productId")
      .equals(productId)
      .toArray();
    if (branchId) results = results.filter((b) => b.branchId === branchId);
    // FIFO order: soonest expiry first; no-expiry batches last
    return results.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return a.createdAt - b.createdAt;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
  }

  async getActiveBatchesForBranch(branchId: string): Promise<InventoryBatchSchema[]> {
    const all = await db.inventory_batches.toArray();
    return all.filter(
      (b) => b.branchId === branchId && b.status === "active" && b.quantityOnHand > 0
    );
  }

  /**
   * Returns batches expiring within `daysAhead` days from today.
   * Includes only active batches with a non-null expiryDate.
   */
  async getExpiringBatches(
    daysAhead: number,
    branchId?: string
  ): Promise<InventoryBatchSchema[]> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + daysAhead);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    let batches = await db.inventory_batches
      .filter(
        (b) =>
          b.status === "active" &&
          !!b.expiryDate &&
          b.expiryDate > todayStr &&
          b.expiryDate <= cutoffStr
      )
      .toArray();

    if (branchId) batches = batches.filter((b) => b.branchId === branchId);
    return batches.sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  }

  /** Returns batches where expiryDate < today. */
  async getExpiredBatches(branchId?: string): Promise<InventoryBatchSchema[]> {
    const todayStr = new Date().toISOString().slice(0, 10);
    let batches = await db.inventory_batches
      .filter(
        (b) =>
          (b.status === "active" || b.status === "expired") &&
          !!b.expiryDate &&
          b.expiryDate < todayStr
      )
      .toArray();
    if (branchId) batches = batches.filter((b) => b.branchId === branchId);
    return batches;
  }

  /**
   * Deduct quantity from a batch (FIFO step — called during sales/adjustments).
   * Returns remaining quantity in the batch after deduction.
   */
  async deductFromBatch(batchId: string, qty: number): Promise<number> {
    const batch = await db.inventory_batches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);
    if (batch.quantityOnHand < qty) {
      throw new Error(
        `Insufficient batch stock. Available: ${batch.quantityOnHand}, Requested: ${qty}`
      );
    }

    const newQty = batch.quantityOnHand - qty;
    const updated: InventoryBatchSchema = {
      ...batch,
      quantityOnHand: newQty,
      status: newQty === 0 ? "depleted" : batch.status,
      updatedAt: Date.now(),
      sync_status: "pending",
    };
    await db.inventory_batches.put(updated);
    await SyncQueueService.enqueue(
      "inventory_batches",
      "UPDATE",
      updated as unknown as Record<string, unknown>,
      { branchId: batch.branchId }
    );
    return newQty;
  }

  /** Mark a batch as expired. */
  async markExpired(batchId: string): Promise<void> {
    const batch = await db.inventory_batches.get(batchId);
    if (!batch) return;
    const updated = { ...batch, status: "expired" as const, updatedAt: Date.now(), sync_status: "pending" as const };
    await db.inventory_batches.put(updated);
    await SyncQueueService.enqueue(
      "inventory_batches",
      "UPDATE",
      updated as unknown as Record<string, unknown>,
      { branchId: batch.branchId }
    );
    await DomainEvents.publish("BATCH_EXPIRED", {
      entity: "InventoryBatch",
      entityId: batchId,
      record: updated,
    });
  }

  /** Expiry summary counts for dashboard. */
  async getExpirySummary(branchId?: string): Promise<{
    expired: number;
    expiring7d: number;
    expiring30d: number;
    expiring60d: number;
    expiring90d: number;
  }> {
    const expired = (await this.getExpiredBatches(branchId)).length;
    const expiring7d = (await this.getExpiringBatches(7, branchId)).length;
    const expiring30d = (await this.getExpiringBatches(30, branchId)).length;
    const expiring60d = (await this.getExpiringBatches(60, branchId)).length;
    const expiring90d = (await this.getExpiringBatches(90, branchId)).length;
    return { expired, expiring7d, expiring30d, expiring60d, expiring90d };
  }
}

export const inventoryBatchRepository = new InventoryBatchRepository();
