import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { SyncScheduler } from "@/services/sync/sync-scheduler";
import { Button } from "@/components/ui/button";

export function SyncStatusIndicator() {
  const { status, unsyncedCount, isSyncing } = useNetworkStatus();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => void SyncScheduler.triggerSync()}
        className="h-7 gap-1.5 px-2 font-normal text-muted-foreground hover:text-foreground"
        title={status === "offline" ? "Offline mode" : `${unsyncedCount} unsynced changes`}
      >
        {isSyncing ? (
          <RefreshCw className="size-3 animate-spin text-primary" />
        ) : status === "offline" ? (
          <WifiOff className="size-3 text-destructive" />
        ) : (
          <Wifi className="size-3 text-success" />
        )}
        <span className="hidden sm:inline capitalize">
          {isSyncing ? "Syncing..." : status}
        </span>
        {unsyncedCount > 0 && (
          <span className="ml-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
            {unsyncedCount}
          </span>
        )}
      </Button>
    </div>
  );
}
