import { SyncManager } from "./sync-manager";

export class SyncScheduler {
  private static timer: ReturnType<typeof setInterval> | null = null;
  private static intervalMs = 30000; // 30s auto-sync interval when online

  static start(intervalMs = this.intervalMs): void {
    this.stop();
    this.intervalMs = intervalMs;

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
    }

    this.timer = setInterval(() => {
      void this.triggerSync();
    }, this.intervalMs);
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
    }
  }

  private static handleOnline = () => {
    void this.triggerSync();
  };

  static async triggerSync(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    await SyncManager.processQueue();
  }
}
