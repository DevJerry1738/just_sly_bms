import { WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { SyncScheduler } from "@/services/sync/sync-scheduler";

export function OfflineBanner() {
  const { status, unsyncedCount } = useNetworkStatus();

  if (status === "online") return null;

  return (
    <div className="bg-warning/15 border-b border-warning/30 px-4 py-2 text-xs text-warning-foreground flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-2">
        <WifiOff className="size-3.5 shrink-0 text-warning" />
        <span>
          <strong>Working Offline.</strong> You have {unsyncedCount} unsynced {unsyncedCount === 1 ? "change" : "changes"} saved locally.
        </span>
      </div>
      <button
        onClick={() => void SyncScheduler.triggerSync()}
        className="inline-flex items-center gap-1 font-medium hover:underline focus:outline-none"
      >
        <RefreshCw className="size-3" /> Retry sync
      </button>
    </div>
  );
}
