import { Building2, Boxes, ShoppingCart, TrendingUp, ArrowUpRight, Plus, Activity, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";

const KPIS = [
  { label: "Branches Active", value: "4", hint: "Across all regions", delta: 0, icon: Building2 },
  { label: "SKUs Tracked", value: "1,248", hint: "+12 added this week", delta: 4.2, icon: Boxes },
  { label: "Retail Sales (Today)", value: "$18,450", hint: "vs $16.2k yesterday", delta: 13.8, icon: ShoppingCart },
  { label: "Wholesale Pipeline", value: "$142,000", hint: "8 pending orders", delta: -2.1, icon: TrendingUp },
];

const RECENT_ACTIVITY = [
  { id: "1", title: "New wholesale order #WO-904", time: "10 mins ago", status: "pending" as const },
  { id: "2", title: "Stock adjustment at East Branch", time: "45 mins ago", status: "approved" as const },
  { id: "3", title: "Low stock alert: Wireless Mouse X", time: "2 hours ago", status: "low-stock" as const },
];

const NEXT_STEPS = [
  { title: "Branch Registry", description: "Model branches, warehouses and staff assignment.", to: "/branches" as const },
  { title: "Product Catalogue", description: "Categories, variants, pricing tiers and barcodes.", to: "/products" as const },
  { title: "Inventory Ledger", description: "Stock movements, transfers and reorder thresholds.", to: "/inventory" as const },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Operational overview across every Just Sly branch. Real-time metrics and quick management actions."
        actions={
          <Button size="sm" className="gap-1.5 text-xs font-medium">
            <Plus className="size-3.5" /> Quick action
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card variant="flat" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Performance & Velocity</CardTitle>
              <CardDescription>Revenue, margin and stock velocity across active branches.</CardDescription>
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            <EmptyState
              icon={TrendingUp}
              title="Analytics activation pending"
              description="Interactive sales charts and inventory velocity breakdown will activate in the analytics sprint."
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card variant="flat">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {RECENT_ACTIVITY.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{act.title}</p>
                    <p className="text-[11px] text-muted-foreground">{act.time}</p>
                  </div>
                  <StatusBadge status={act.status} dot={false} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="flat">
            <CardHeader className="pb-3">
              <CardTitle>Up Next</CardTitle>
              <CardDescription>Backlog priorities for upcoming sprints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {NEXT_STEPS.map((step) => (
                <Link
                  key={step.to}
                  to={step.to}
                  className="flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent/50 hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground">{step.description}</p>
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
