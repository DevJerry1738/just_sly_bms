import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  action?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageWrapper({
  title,
  description,
  actions,
  action,
  filters,
  children,
  className,
}: PageWrapperProps) {
  const renderedActions = action ?? actions;

  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <PageHeader title={title} description={description} actions={renderedActions} />
      {filters && (
        <div className="flex flex-wrap items-center gap-3 pb-1 border-b border-border/60">
          {filters}
        </div>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
