import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-2 border-b border-border/40", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-semibold text-xl sm:text-2xl tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground text-balance-tight">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
