import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  variant?: "card" | "inline";
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Try again in a moment.",
  onRetry,
  variant = "card",
  className,
}: ErrorStateProps) {
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive", className)}>
        <AlertTriangle className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground opacity-90 truncate">{description}</p>
        </div>
        {onRetry && (
          <Button variant="ghost" size="xs" onClick={onRetry} className="h-7 text-xs text-destructive hover:bg-destructive/10">
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-card px-6 py-10 text-center shadow-2xs",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground leading-normal">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs mt-1">
          <RotateCcw className="size-3.5" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
