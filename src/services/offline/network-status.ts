import { SyncQueueService } from "@/services/sync/sync-queue";
import type { NetworkStatusState, NetworkStatusType } from "@/services/sync/types";

export class NetworkStatusService {
  private static listeners = new Set<(state: NetworkStatusState) => void>();
  private static currentState: NetworkStatusState = {
    status: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
    lastSyncedAt: null,
    isSyncing: false,
    unsyncedCount: 0,
  };

  static init(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => this.updateStatus("online"));
    window.addEventListener("offline", () => this.updateStatus("offline"));

    void this.refreshUnsyncedCount();
  }

  static subscribe(listener: (state: NetworkStatusState) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  static getState(): NetworkStatusState {
    return this.currentState;
  }

  static updateStatus(status: NetworkStatusType): void {
    this.currentState = { ...this.currentState, status };
    this.notify();
  }

  static setSyncing(isSyncing: boolean): void {
    this.currentState = {
      ...this.currentState,
      isSyncing,
      lastSyncedAt: isSyncing ? this.currentState.lastSyncedAt : Date.now(),
    };
    this.notify();
  }

  static async refreshUnsyncedCount(): Promise<void> {
    try {
      const count = await SyncQueueService.getUnsyncedCount();
      this.currentState = { ...this.currentState, unsyncedCount: count };
      this.notify();
    } catch {
      // IndexedDB fallback
    }
  }

  private static notify(): void {
    this.listeners.forEach((listener) => listener(this.currentState));
  }
}

NetworkStatusService.init();
