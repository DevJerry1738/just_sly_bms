import { SyncQueueService } from "./sync-queue";
import type { EntitySyncHandler, SyncResult } from "./types";

export class SyncManager {
  private static handlers = new Map<string, EntitySyncHandler>();
  private static listeners = new Set<(event: string, data?: unknown) => void>();
  private static isSyncing = false;

  /**
   * Registers a sync handler for a specific business entity (e.g. 'products', 'sales').
   */
  static registerHandler(entityType: string, handler: EntitySyncHandler): void {
    this.handlers.set(entityType, handler);
  }

  /**
   * Subscribes to sync events (start, progress, complete, error).
   */
  static subscribe(listener: (event: string, data?: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static emit(event: string, data?: unknown): void {
    this.listeners.forEach((listener) => listener(event, data));
  }

  /**
   * Process pending items in the SyncQueue, optionally limited to entity types.
   */
  static async processQueue(entityTypes?: string[]): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: [{ itemId: "net", error: "Offline" }] };
    }

    this.isSyncing = true;
    this.emit("sync:start");

    let syncedCount = 0;
    let failedCount = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    try {
      const pendingItems = await SyncQueueService.getPendingItems();
      const items = entityTypes?.length
        ? pendingItems.filter((item) => entityTypes.includes(item.entityType))
        : pendingItems;

      for (const item of items) {
        const handler = this.handlers.get(item.entityType);

        if (!handler) {
          const errorMessage = `No sync handler registered for entity "${item.entityType}"`;
          await SyncQueueService.updateStatus(item.id, "failed", errorMessage);
          failedCount++;
          errors.push({ itemId: item.id, error: errorMessage });
          continue;
        }

        if (item.dependency) {
          const dependencyPending = items.some(
            (candidate) =>
              candidate.id !== item.id &&
              candidate.payload["id"] === item.dependency &&
              ["pending", "syncing"].includes(candidate.status),
          );
          if (dependencyPending) continue;

          const dependencyFailed = items.some(
            (candidate) =>
              candidate.id !== item.id &&
              candidate.payload["id"] === item.dependency &&
              candidate.status === "failed",
          );
          if (dependencyFailed) {
            const errorMessage = `Dependency ${item.dependency} failed; child record was not uploaded`;
            await SyncQueueService.updateStatus(item.id, "failed", errorMessage);
            failedCount++;
            errors.push({ itemId: item.id, error: errorMessage });
            continue;
          }
        }

        await SyncQueueService.updateStatus(item.id, "syncing");

        try {
          const res = await handler(item.operationType, item.payload);

          if (res.success) {
            syncedCount++;
            await SyncQueueService.removeCompleted(item.id);
            this.emit("sync:progress", { itemId: item.id, status: "completed" });
          } else {
            failedCount++;
            const errMsg = res.error ?? "Unknown sync handler error";
            errors.push({ itemId: item.id, error: errMsg });
            await SyncQueueService.updateStatus(item.id, "failed", errMsg);
            this.emit("sync:progress", { itemId: item.id, status: "failed", error: errMsg });
          }
        } catch (err: unknown) {
          failedCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push({ itemId: item.id, error: errMsg });
          await SyncQueueService.updateStatus(item.id, "failed", errMsg);
          this.emit("sync:progress", { itemId: item.id, status: "failed", error: errMsg });
        }
      }

      this.emit("sync:complete", { syncedCount, failedCount });
      return { success: failedCount === 0, syncedCount, failedCount, errors };
    } finally {
      this.isSyncing = false;
    }
  }
}
