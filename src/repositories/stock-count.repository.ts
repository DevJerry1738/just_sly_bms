import { BaseRepository } from "./base.repository";
import { db } from "@/database/schema";
import type {
  StockCountSessionSchema,
  StockCountItemSchema,
  StockCountStatus,
} from "@/database/schema";
import { inventoryTransactionRepository } from "./inventory-transaction.repository";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// Session number: SC-YYYYMMDD-XXXX
// ---------------------------------------------------------------------------
async function generateSessionNumber(): Promise<string> {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await db.stock_count_sessions.count();
  return `SC-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export class StockCountRepository extends BaseRepository<StockCountSessionSchema> {
  constructor() {
    super("stock_count_sessions", db.stock_count_sessions);
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Start a new stock count session for a branch.
   * Optionally restrict to a subset of productIds (partial scope).
   * Creates item rows from current inventory balances (snapshot).
   */
  async startSession(
    branchId: string,
    createdBy: string,
    createdByName?: string,
    scope: "full" | "partial" = "full",
    productIds?: string[]
  ): Promise<StockCountSessionSchema> {
    const now = Date.now();
    const session: StockCountSessionSchema = {
      id: crypto.randomUUID(),
      sessionNumber: await generateSessionNumber(),
      branchId,
      status: "in_progress",
      scope,
      snapshotAt: now,
      startedAt: now,
      completedAt: null,
      approvedAt: null,
      approvedBy: null,
      approvedByName: null,
      cancelledAt: null,
      cancelledBy: null,
      notes: undefined,
      totalVarianceValue: 0,
      createdBy,
      createdByName,
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    await db.stock_count_sessions.put(session);
    await SyncQueueService.enqueue(
      "stock_count_sessions",
      "CREATE",
      session as unknown as Record<string, unknown>,
      { branchId }
    );

    // Populate items from current balances
    const balances = await db.inventory_balances
      .where("branchId")
      .equals(branchId)
      .toArray();

    const filteredBalances =
      productIds && scope === "partial"
        ? balances.filter((b) => productIds.includes(b.productId))
        : balances;

    for (const balance of filteredBalances) {
      const product = await db.products.get(balance.productId);
      if (!product || product.status !== "active") continue;

      // For batch-tracked products, create one item per active batch
      const batches = await db.inventory_batches
        .where("productId")
        .equals(balance.productId)
        .filter((b) => b.branchId === branchId && b.status === "active" && b.quantityOnHand > 0)
        .toArray();

      if (batches.length > 0) {
        for (const batch of batches) {
          const item: StockCountItemSchema = {
            id: crypto.randomUUID(),
            sessionId: session.id,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            baseUnit: product.baseUnit,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate ?? null,
            systemQuantity: batch.quantityOnHand,
            countedQuantity: null,
            variance: null,
            unitCost: batch.unitCost,
            varianceValue: null,
            notes: undefined,
            countedBy: null,
            countedAt: null,
            sync_status: "pending",
          };
          await db.stock_count_items.put(item);
          await SyncQueueService.enqueue("stock_count_items", "CREATE", item as unknown as Record<string, unknown>, { branchId });
        }
      } else {
        // No batch — single item from balance
        const item: StockCountItemSchema = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          baseUnit: product.baseUnit,
          batchId: null,
          batchNumber: null,
          expiryDate: null,
          systemQuantity: balance.quantityOnHand,
          countedQuantity: null,
          variance: null,
          unitCost: balance.weightedAvgCost,
          varianceValue: null,
          notes: undefined,
          countedBy: null,
          countedAt: null,
          sync_status: "pending",
        };
        await db.stock_count_items.put(item);
        await SyncQueueService.enqueue("stock_count_items", "CREATE", item as unknown as Record<string, unknown>, { branchId });
      }
    }

    await DomainEvents.publish("STOCK_COUNT_STARTED", {
      entity: "StockCountSession",
      entityId: session.id,
      record: session,
    });

    return session;
  }

  /** Record the physical count for a single item. */
  async recordCount(
    itemId: string,
    countedQuantity: number,
    countedBy: string,
    notes?: string
  ): Promise<StockCountItemSchema> {
    const item = await db.stock_count_items.get(itemId);
    if (!item) throw new Error(`Stock count item ${itemId} not found`);

    const variance = countedQuantity - item.systemQuantity;
    const updated: StockCountItemSchema = {
      ...item,
      countedQuantity,
      variance,
      varianceValue: variance * item.unitCost,
      notes: notes ?? item.notes,
      countedBy,
      countedAt: Date.now(),
      sync_status: "pending",
    };
    await db.stock_count_items.put(updated);
    await SyncQueueService.enqueue("stock_count_items", "UPDATE", updated as unknown as Record<string, unknown>);
    return updated;
  }

  /** Get all items for a session, with computed variances. */
  async getSessionItems(sessionId: string): Promise<StockCountItemSchema[]> {
    return db.stock_count_items.where("sessionId").equals(sessionId).toArray();
  }

  /** Return only items with non-zero variance. */
  async getVariances(sessionId: string): Promise<StockCountItemSchema[]> {
    const items = await this.getSessionItems(sessionId);
    return items.filter((i) => i.variance !== null && i.variance !== 0);
  }

  /**
   * Approve and apply a stock count session.
   * Creates adjustment transactions for every item with a non-zero variance.
   * Closes the session.
   */
  async applySession(
    sessionId: string,
    approvedBy: string,
    approvedByName?: string
  ): Promise<void> {
    const session = await db.stock_count_sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== "in_progress" && session.status !== "pending_approval") {
      throw new Error(`Session is in status "${session.status}" and cannot be applied`);
    }

    const variances = await this.getVariances(sessionId);
    let totalVarianceValue = 0;

    for (const item of variances) {
      if (item.variance === null || item.variance === 0) continue;

      await inventoryTransactionRepository.recordTransaction({
        type: "stock_count",
        productId: item.productId,
        branchId: session.branchId,
        quantity: item.variance,
        baseUnit: item.baseUnit,
        unitCost: item.unitCost,
        batchId: item.batchId,
        sessionId,
        notes: `Stock count reconciliation — Session ${session.sessionNumber}`,
        performedBy: approvedBy,
        performedByName: approvedByName,
        referenceNumber: `${session.sessionNumber}-ADJ`,
      });

      totalVarianceValue += Math.abs(item.varianceValue ?? 0);
    }

    const now = Date.now();
    const updatedSession: StockCountSessionSchema = {
      ...session,
      status: "approved",
      approvedAt: now,
      approvedBy,
      approvedByName,
      completedAt: now,
      totalVarianceValue,
      updatedAt: now,
      sync_status: "pending",
    };
    await db.stock_count_sessions.put(updatedSession);
    await SyncQueueService.enqueue(
      "stock_count_sessions",
      "UPDATE",
      updatedSession as unknown as Record<string, unknown>,
      { branchId: session.branchId }
    );

    await DomainEvents.publish("STOCK_COUNT_APPROVED", {
      entity: "StockCountSession",
      entityId: sessionId,
      record: updatedSession,
    });
  }

  /** Move session to pending_approval state. */
  async submitForApproval(sessionId: string): Promise<StockCountSessionSchema> {
    const session = await db.stock_count_sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const updated = { ...session, status: "pending_approval" as StockCountStatus, updatedAt: Date.now(), sync_status: "pending" as const };
    await db.stock_count_sessions.put(updated);
    await SyncQueueService.enqueue("stock_count_sessions", "UPDATE", updated as unknown as Record<string, unknown>, { branchId: session.branchId });
    return updated;
  }

  /** Cancel a session (no adjustments are applied). */
  async cancelSession(sessionId: string, cancelledBy: string): Promise<void> {
    const session = await db.stock_count_sessions.get(sessionId);
    if (!session) return;
    const updated: StockCountSessionSchema = {
      ...session,
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy,
      updatedAt: Date.now(),
      sync_status: "pending",
    };
    await db.stock_count_sessions.put(updated);
    await SyncQueueService.enqueue("stock_count_sessions", "UPDATE", updated as unknown as Record<string, unknown>, { branchId: session.branchId });
  }

  async getSessionsByBranch(branchId: string): Promise<StockCountSessionSchema[]> {
    return db.stock_count_sessions
      .where("branchId")
      .equals(branchId)
      .reverse()
      .sortBy("startedAt");
  }
}

export const stockCountRepository = new StockCountRepository();
