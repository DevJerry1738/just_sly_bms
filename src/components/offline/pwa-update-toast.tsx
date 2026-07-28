import { RefreshCw } from "lucide-react";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { Button } from "@/components/ui/button";

export function PWAUpdateToast() {
  const { needRefresh, updateServiceWorker } = useServiceWorker();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg animate-slide-up">
      <div className="text-xs">
        <p className="font-semibold text-foreground">Update Available</p>
        <p className="text-muted-foreground">A new version of Just Sly Suite is ready.</p>
      </div>
      <Button size="xs" onClick={updateServiceWorker} className="gap-1 text-xs">
        <RefreshCw className="size-3" /> Update
      </Button>
    </div>
  );
}
