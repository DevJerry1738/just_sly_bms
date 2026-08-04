import { BaseRepository } from "./base.repository";
import { db } from "@/database/schema";
import type { InventoryAdjustmentSchema, AdjustmentReason } from "@/database/schema";
import {
  inventoryTransactionRepository,
} from "./inventory-transaction.repository";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

export interface CreateAdjustmentInput {
  productId: string;
  branchId: string;
  /** Signed quantity in base units (positive = add, negative = remove). */
  quantity: number;
  baseUnit: string;
  unitCost: number;
  reason: AdjustmentReason;
  notes?: string;
  batchId?: string | null;
  performedBy: string;
  performedByName?: string;
}

export class InventoryAdjustmentRepository extends BaseRepository<InventoryAdjustmentSchema> {
  constructor() {
    super("inventory_adjustments", db.inventory_adjustments);
  }

  async createAdjustment(input: CreateAdjustmentInput): Promise<InventoryAdjustmentSchema> {
    // 1. Get current balance before adjustment
    const balanceId = `${input.productId}::${input.branchId}`;
    const currentBalance = await db.inventory_balances.get(balanceId);
    const qtyBefore = currentBalance?.quantityOnHand ?? 0;

    // 2. Record the ledger transaction
    const txn = await inventoryTransactionRepository.recordTransaction({
      type: "stock_adjustment",
      productId: input.productId,
      branchId: input.branchId,
      quantity: input.quantity,
      baseUnit: input.baseUnit,
      unitCost: input.unitCost,
      batchId: input.batchId,
      notes: input.notes,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
    });

    // 3. Create the adjustment detail record
    const now = Date.now();
    const adjustment: InventoryAdjustmentSchema = {
      id: crypto.randomUUID(),
      transactionId: txn.id,
      productId: input.productId,
      branchId: input.branchId,
      reason: input.reason,
      notes: input.notes,
      quantityBefore: qtyBefore,
      quantityAfter: qtyBefore + input.quantity,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
      timestamp: now,
      sync_status: "pending",
    };

    await db.inventory_adjustments.put(adjustment);
    await SyncQueueService.enqueue(
      "inventory_adjustments",
      "CREATE",
      adjustment as unknown as Record<string, unknown>,
      { branchId: input.branchId }
    );

    await DomainEvents.publish("STOCK_ADJUSTED", {
      entity: "InventoryAdjustment",
      entityId: adjustment.id,
      record: adjustment,
    });

    return adjustment;
  }

  async getAdjustmentsForProduct(
    productId: string,
    branchId?: string
  ): Promise<InventoryAdjustmentSchema[]> {
    let results = await db.inventory_adjustments
      .where("productId")
      .equals(productId)
      .toArray();
    if (branchId) results = results.filter((a) => a.branchId === branchId);
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getByBranch(branchId: string): Promise<InventoryAdjustmentSchema[]> {
    return db.inventory_adjustments
      .where("branchId")
      .equals(branchId)
      .reverse()
      .sortBy("timestamp");
  }
}

export const inventoryAdjustmentRepository = new InventoryAdjustmentRepository();
