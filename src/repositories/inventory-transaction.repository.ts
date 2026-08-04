import { db } from "@/database/schema";
import type {
  InventoryTransactionSchema,
  InventoryTransactionType,
  InventoryBalanceSchema,
} from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// Reference number generator: TXN-YYYYMMDD-XXXX
// ---------------------------------------------------------------------------
async function generateReferenceNumber(prefix = "TXN"): Promise<string> {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await db.inventory_transactions.count();
  return `${prefix}-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Balance helpers (internal — not exported)
// ---------------------------------------------------------------------------

function balanceId(productId: string, branchId: string): string {
  return `${productId}::${branchId}`;
}

async function getOrCreateBalance(
  productId: string,
  branchId: string
): Promise<InventoryBalanceSchema> {
  const id = balanceId(productId, branchId);
  const existing = await db.inventory_balances.get(id);
  if (existing) return existing;

  const fresh: InventoryBalanceSchema = {
    id,
    productId,
    branchId,
    quantityOnHand: 0,
    reservedQuantity: 0,
    incomingQuantity: 0,
    valuationMethod: "fifo",
    totalCostValue: 0,
    weightedAvgCost: 0,
    lastTransactionId: "",
    updatedAt: Date.now(),
    sync_status: "pending",
  };
  await db.inventory_balances.put(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// InventoryTransactionRepository
// ---------------------------------------------------------------------------

export interface RecordTransactionInput {
  type: InventoryTransactionType;
  productId: string;
  branchId: string;
  /** Signed quantity in base units. Positive = stock in, negative = stock out. */
  quantity: number;
  baseUnit: string;
  unitCost: number;
  batchId?: string | null;
  sessionId?: string | null;
  notes?: string;
  performedBy: string;
  performedByName?: string;
  referenceNumber?: string;
}

export class InventoryTransactionRepository {
  /**
   * Record an inventory transaction and atomically update the cached balance.
   * This is the ONLY permitted way to change stock quantities.
   */
  async recordTransaction(
    input: RecordTransactionInput
  ): Promise<InventoryTransactionSchema> {
    const refNum =
      input.referenceNumber ?? (await generateReferenceNumber("TXN"));
    const now = Date.now();

    const transaction: InventoryTransactionSchema = {
      id: crypto.randomUUID(),
      type: input.type,
      productId: input.productId,
      branchId: input.branchId,
      quantity: input.quantity,
      baseUnit: input.baseUnit,
      unitCost: input.unitCost,
      referenceNumber: refNum,
      batchId: input.batchId ?? null,
      sessionId: input.sessionId ?? null,
      notes: input.notes,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
      timestamp: now,
      sync_status: "pending",
    };

    // Atomic write: ledger entry + balance delta (writes only — no sync enqueue inside)
    let updatedBalance: InventoryBalanceSchema | null = null;
    await db.transaction(
      "rw",
      [db.inventory_transactions, db.inventory_balances],
      async () => {
        await db.inventory_transactions.put(transaction);
        updatedBalance = await this._applyBalanceDelta(
          input.productId,
          input.branchId,
          input.quantity,
          input.unitCost,
          transaction.id
        );
      }
    );

    // Enqueue sync AFTER transaction closes (avoids nested Dexie transaction conflict)
    await SyncQueueService.enqueue(
      "inventory_transactions",
      "CREATE",
      transaction as unknown as Record<string, unknown>,
      { branchId: input.branchId }
    );
    if (updatedBalance) {
      await SyncQueueService.enqueue(
        "inventory_balances",
        "UPSERT",
        updatedBalance as unknown as Record<string, unknown>,
        { branchId: input.branchId }
      );
    }

    // Publish domain event for audit logging
    await DomainEvents.publish(`INVENTORY_${input.type.toUpperCase()}`, {
      entity: "InventoryTransaction",
      entityId: transaction.id,
      record: transaction,
    });

    return transaction;
  }

  /**
   * Apply a signed delta to a balance record.
   * Returns the updated balance for the caller to enqueue — does NOT call SyncQueueService itself
   * so it is safe to call from inside a Dexie transaction.
   */
  private async _applyBalanceDelta(
    productId: string,
    branchId: string,
    delta: number,
    unitCost: number,
    transactionId: string
  ): Promise<InventoryBalanceSchema> {
    const balance = await getOrCreateBalance(productId, branchId);
    const newQty = balance.quantityOnHand + delta;
    const newCostValue =
      delta > 0
        ? balance.totalCostValue + delta * unitCost
        : balance.totalCostValue + delta * balance.weightedAvgCost;

    const safeQty = Math.max(0, newQty);
    const safeCostValue = Math.max(0, newCostValue);

    const updated: InventoryBalanceSchema = {
      ...balance,
      quantityOnHand: safeQty,
      totalCostValue: safeCostValue,
      weightedAvgCost: safeQty > 0 ? safeCostValue / safeQty : 0,
      lastTransactionId: transactionId,
      updatedAt: Date.now(),
      sync_status: "pending",
    };

    await db.inventory_balances.put(updated);
    return updated;
  }

  /** Paginated history for a product (optionally filtered by branch). */
  async getForProduct(
    productId: string,
    opts?: { branchId?: string; limit?: number; offset?: number }
  ): Promise<InventoryTransactionSchema[]> {
    let query = db.inventory_transactions.where("productId").equals(productId);
    let results = await query.reverse().sortBy("timestamp");
    if (opts?.branchId) {
      results = results.filter((t) => t.branchId === opts.branchId);
    }
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  /** All transactions for a branch with optional type filter. */
  async getForBranch(
    branchId: string,
    opts?: { type?: string; limit?: number; offset?: number; fromTs?: number; toTs?: number }
  ): Promise<InventoryTransactionSchema[]> {
    let results = await db.inventory_transactions
      .where("branchId")
      .equals(branchId)
      .reverse()
      .sortBy("timestamp");

    if (opts?.type) results = results.filter((t) => t.type === opts.type);
    if (opts?.fromTs) results = results.filter((t) => t.timestamp >= opts.fromTs!);
    if (opts?.toTs) results = results.filter((t) => t.timestamp <= opts.toTs!);

    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /** All transactions (cross-branch) with filters — for history table. */
  async getAll(opts?: {
    productId?: string;
    branchId?: string;
    type?: string;
    performedBy?: string;
    referenceNumber?: string;
    fromTs?: number;
    toTs?: number;
    limit?: number;
    offset?: number;
  }): Promise<InventoryTransactionSchema[]> {
    let results = await db.inventory_transactions.toArray();
    results.sort((a, b) => b.timestamp - a.timestamp);

    if (opts?.productId) results = results.filter((t) => t.productId === opts.productId);
    if (opts?.branchId) results = results.filter((t) => t.branchId === opts.branchId);
    if (opts?.type) results = results.filter((t) => t.type === opts.type);
    if (opts?.performedBy) results = results.filter((t) => t.performedBy === opts.performedBy);
    if (opts?.referenceNumber)
      results = results.filter((t) =>
        t.referenceNumber.toLowerCase().includes(opts.referenceNumber!.toLowerCase())
      );
    if (opts?.fromTs) results = results.filter((t) => t.timestamp >= opts.fromTs!);
    if (opts?.toTs) results = results.filter((t) => t.timestamp <= opts.toTs!);

    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  async getById(id: string): Promise<InventoryTransactionSchema | undefined> {
    return db.inventory_transactions.get(id);
  }

  async getByReference(ref: string): Promise<InventoryTransactionSchema | undefined> {
    return db.inventory_transactions.where("referenceNumber").equals(ref).first();
  }
}

export const inventoryTransactionRepository = new InventoryTransactionRepository();
