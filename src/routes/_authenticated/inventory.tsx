import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "@/features/inventory/components/inventory-page";
import { PermissionGuard } from "@/components/common/permission-guard";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

function InventoryRouteGuard() {
  return (
    <PermissionGuard
      permission="inventory:view"
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4 p-8 text-center">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="size-7 text-destructive" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-lg font-semibold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view inventory balances or stock controls.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/">Go to Dashboard</a>
          </Button>
        </div>
      }
    >
      <InventoryPage />
    </PermissionGuard>
  );
}

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Just Sly Suite" },
      { name: "description", content: "Real-time stock levels, movements and transfers." },
      { property: "og:title", content: "Inventory — Just Sly Suite" },
      { property: "og:description", content: "Real-time stock levels, movements and transfers." },
    ],
  }),
  component: InventoryRouteGuard,
});
