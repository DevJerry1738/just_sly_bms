import { Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";

export function PWAInstallButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={() => void promptInstall()}
      className="h-7 gap-1 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
    >
      <Download className="size-3" /> Install App
    </Button>
  );
}
