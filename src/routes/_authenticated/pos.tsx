import { createFileRoute } from "@tanstack/react-router";

import { PosPage } from "@/features/pos/pos-page";
import { PermissionGuard } from "@/components/common/permission-guard";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

function PosRouteGuard() {
  return (
    <PermissionGuard
      permission="sales:create"
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4 p-8 text-center">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="size-7 text-destructive" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-lg font-semibold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground">
              You do not have permission to access the Point of Sale (POS) system. Your access has been restricted by an administrator.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/">Go to Dashboard</a>
          </Button>
        </div>
      }
    >
      <PosPage />
    </PermissionGuard>
  );
}

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS — Just Sly Suite" },
      { name: "description", content: "Retail point of sale for quick checkout." },
    ],
  }),
  component: PosRouteGuard,
});
