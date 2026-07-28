import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

export function StatCard({ label, value, hint, delta, icon: Icon, className }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  const DeltaIcon = positive ? TrendingUp : TrendingDown;

  return (
    <Card variant="flat" className={cn("transition-all duration-150 hover:border-border/80 hover:bg-card/80", className)}>
      <CardContent className="space-y-2.5 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <Icon className="size-3.5" />
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {(typeof delta === "number" || hint) && (
          <div className="flex items-center gap-2 text-xs">
            {typeof delta === "number" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded text-[11px]",
                  positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}
              >
                <DeltaIcon className="size-3" />
                {positive ? "+" : ""}
                {delta}%
              </span>
            ) : null}
            {hint ? <span className="text-muted-foreground text-[11px] truncate">{hint}</span> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
