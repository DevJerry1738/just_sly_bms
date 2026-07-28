import { db } from "@/database/schema";
import type { SyncOperationType, SyncQueueItem } from "./types";

export class SyncQueueService {
  /**
   * Enqueues a new mutation payload into the persistent IndexedDB queue.
   */
  static async enqueue(
    entityType: string,
    operationType: SyncOperationType,
    payload: Record<string, unknown>,
    options?: {
      priority?: number;
      dependency?: string;
      createdBy?: string;
      branchId?: string;
    }
  ): Promise<string> {
    const id = crypto.randomUUID();
    const queueItem: SyncQueueItem = {
      id,
      entityType,
      operationType,
      payload,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
      priority: options?.priority ?? 1,
      dependency: options?.dependency,
      createdBy: options?.createdBy,
      branchId: options?.branchId,
    };

    await db.syncQueue.put(queueItem);
    return id;
  }

  /**
   * Fetches pending queue items ordered by priority (descending) and timestamp (ascending).
   */
  static async getPendingItems(): Promise<SyncQueueItem[]> {
    return db.syncQueue
      .where("status")
      .equals("pending")
      .sortBy("priority");
  }

  /**
   * Returns total number of unsynced items.
   */
  static async getUnsyncedCount(): Promise<number> {
    return db.syncQueue
      .where("status")
      .anyOf("pending", "syncing", "failed")
      .count();
  }

  /**
   * Updates status of a queue item.
   */
  static async updateStatus(
    id: string,
    status: SyncQueueItem["status"],
    errorMessage?: string
  ): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (!item) return;

    await db.syncQueue.update(id, {
      status,
      errorMessage: errorMessage ?? item.errorMessage,
      retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
    });
  }

  /**
   * Removes completed items from the queue.
   */
  static async removeCompleted(id: string): Promise<void> {
    await db.syncQueue.delete(id);
  }

  /**
   * Clears all completed items.
   */
  static async purgeCompleted(): Promise<void> {
    await db.syncQueue.where("status").equals("completed").delete();
  }
}
