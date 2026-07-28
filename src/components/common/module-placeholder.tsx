import type { ComponentType, ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  sprint?: string;
  capabilities: string[];
  actions?: ReactNode;
}

/**
 * Shared scaffold for feature modules that ship in a later sprint.
 * Keeps every placeholder route visually consistent with delivered modules.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  sprint = "Planned",
  capabilities,
  actions,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={title}
        description={description}
        actions={
          actions ?? (
            <Badge variant="secondary" size="sm" className="font-semibold text-[10px] uppercase tracking-wider">
              {sprint}
            </Badge>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((capability) => (
          <Card key={capability} variant="flat" className="p-4 transition-colors hover:border-border/80">
            <div className="flex items-center gap-2 mb-1">
              <span className="size-1.5 rounded-full bg-primary/60" />
              <p className="text-xs font-semibold text-foreground">{capability}</p>
            </div>
            <p className="text-[11px] text-muted-foreground pl-3">Scheduled for an upcoming sprint</p>
          </Card>
        ))}
      </div>

      <EmptyState
        icon={Icon}
        title={`${title} module is scaffolded`}
        description="Routing, layout, services and types are ready. Business logic lands in a future sprint."
      />
    </div>
  );
}
