import { Link } from "@tanstack/react-router";
import { MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesHistory } from "./sales-history";

export function SalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Monitor sales transactions and launch retail checkout.
          </p>
        </div>
        <Button asChild>
          <Link to="/pos">
            <MonitorPlay className="mr-2 h-4 w-4" />
            Open Retail POS
          </Link>
        </Button>
      </div>

      <SalesHistory />
    </div>
  );
}
