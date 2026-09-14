import { SyncQueueService } from "./sync-queue";
import type { EntitySyncHandler, SyncQueueItem, SyncResult } from "./types";

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

  private static getDependencyEntityType(entityType: string): string | undefined {
    if (["sale_items", "sale_payments", "sale_voids"].includes(entityType)) return "sales";
    if ([
      "wholesale_order_items",
      "order_status_history",
      "order_payments",
      "payment_receipts",
      "invoices",
    ].includes(entityType)) return "wholesale_orders";
    return undefined;
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
      const dependencyItems = await SyncQueueService.getDependencyItems();
      const dependencyState = new Map<string, SyncQueueItem["status"]>();
      for (const candidate of dependencyItems) {
        const parentEntityType = this.getDependencyEntityType(candidate.entityType) ?? candidate.entityType;
        const key = `${parentEntityType}:${String(candidate.payload["id"])}`;
        const existingStatus = dependencyState.get(key);
        if (existingStatus === "pending" || existingStatus === "syncing") continue;
        if (candidate.status === "pending" || candidate.status === "syncing") {
          dependencyState.set(key, candidate.status);
        } else if (candidate.status === "failed" || !existingStatus) {
          dependencyState.set(key, candidate.status);
        }
      }
      const items = (entityTypes?.length
        ? pendingItems.filter((item) => entityTypes.includes(item.entityType))
        : pendingItems
      ).sort((left, right) => {
        const leftIsChild = Boolean(left.dependency);
        const rightIsChild = Boolean(right.dependency);
        if (leftIsChild !== rightIsChild) return leftIsChild ? 1 : -1;
        return left.timestamp - right.timestamp;
      });

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
          const dependencyEntityType = this.getDependencyEntityType(item.entityType);
          const dependencyKey = dependencyEntityType
            ? `${dependencyEntityType}:${item.dependency}`
            : item.dependency;
          const dependencyStatus = dependencyState.get(dependencyKey);
          if (dependencyStatus === "pending" || dependencyStatus === "syncing") continue;

          if (dependencyStatus === "failed") {
            const errorMessage = `Dependency ${item.dependency} failed; child record was not uploaded`;
            await SyncQueueService.updateStatus(item.id, "failed", errorMessage);
            dependencyState.set(`${item.entityType}:${String(item.payload["id"])}`, "failed");
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
            dependencyState.set(`${item.entityType}:${String(item.payload["id"])}`, "completed");
            await SyncQueueService.removeCompleted(item.id);
            this.emit("sync:progress", { itemId: item.id, status: "completed" });
          } else {
            failedCount++;
            const errMsg = res.error ?? "Unknown sync handler error";
            errors.push({ itemId: item.id, error: errMsg });
            await SyncQueueService.updateStatus(item.id, "failed", errMsg);
            dependencyState.set(`${item.entityType}:${String(item.payload["id"])}`, "failed");
            this.emit("sync:progress", { itemId: item.id, status: "failed", error: errMsg });
          }
        } catch (err: unknown) {
          failedCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push({ itemId: item.id, error: errMsg });
          await SyncQueueService.updateStatus(item.id, "failed", errMsg);
          dependencyState.set(`${item.entityType}:${String(item.payload["id"])}`, "failed");
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
