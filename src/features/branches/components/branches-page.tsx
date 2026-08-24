import { useEffect, useMemo, useState } from "react";
import { Building2, Edit2, Plus, Settings2 } from "lucide-react";

import { branchRepository } from "@/repositories/branch.repository";
import { SyncScheduler } from "@/services/sync/sync-scheduler";
import type { BranchSchema } from "@/database/schema";
import { BranchFormModal } from "./branch-form-modal";
import { BranchSettingsModal } from "./branch-settings-modal";
import { PermissionGuard } from "@/components/common/permission-guard";
import { useAuthorization } from "@/hooks/use-authorization";
import { useBranch } from "@/providers/branch-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function BranchesPage() {
  const { isSuperAdmin } = useAuthorization();
  const { activeBranch } = useBranch();
  const [branches, setBranches] = useState<BranchSchema[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchSchema | null>(null);
  const [settingsBranch, setSettingsBranch] = useState<BranchSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      await SyncScheduler.triggerSync();
      const list = await branchRepository.ensureSeedBranches();
      const visibleBranches = isSuperAdmin
        ? list
        : list.filter((branch) => branch.id === activeBranch?.id);
      setBranches(visibleBranches.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("[BranchesPage] Failed to load branches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, [activeBranch?.id, isSuperAdmin]);

  const totals = useMemo(
    () => ({
      total: branches.length,
      active: branches.filter((branch) => branch.status === "active").length,
      inactive: branches.filter((branch) => branch.status === "inactive").length,
      closed: branches.filter((branch) => branch.status === "temporarily_closed").length,
    }),
    [branches],
  );

  const handleSuccess = async () => {
    await loadBranches();
  };

  return (
    <>
      <PermissionGuard
        permission="branches:view"
        fallback={
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            You do not have permission to view branch management. Contact your administrator if you believe this is an error.
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 text-primary">
                <Building2 className="size-5" />
                <h1 className="text-2xl font-semibold">Branches</h1>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Register, configure, and monitor each branch, warehouse, and point of sale.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard permission="branches:create">
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="size-4" />
                  New Branch
                </Button>
              </PermissionGuard>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total branches</CardTitle>
                <CardDescription>{totals.total} branch records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold">{totals.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold">{totals.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Inactive / Closed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  <span>{totals.inactive} inactive</span>
                  <span>{totals.closed} temporarily closed</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b border-border/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Branch directory</h2>
                <p className="text-sm text-muted-foreground">Manage branch details, status, and operational settings.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-2 py-1">
                  {isLoading ? "Refreshing…" : "Up to date"}
                </Badge>
                <span>{branches.length} branches</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Branch</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Receipt Prefix</th>
                    <th className="px-6 py-3">Updated</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id} className="border-t border-border/70 last:border-b">
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-foreground">{branch.name}</div>
                        <div className="text-[11px] text-muted-foreground">{branch.code}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div>{branch.city || branch.address || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{branch.state || branch.country || "—"}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Badge variant={branch.status === "active" ? "secondary" : "outline"} className="text-[11px] uppercase tracking-[.18em]">
                          {branch.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 align-top text-xs text-muted-foreground">{branch.receiptPrefix || "—"}</td>
                      <td className="px-6 py-4 align-top text-xs text-muted-foreground">
                        {new Date(branch.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <PermissionGuard permission="branches:update">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEditingBranch(branch)}>
                              <Edit2 className="size-4" />
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="branches:update">
                            <Button variant="ghost" size="icon-sm" onClick={() => setSettingsBranch(branch)}>
                              <Settings2 className="size-4" />
                            </Button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!branches.length && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                        No branches available. Create your first branch to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PermissionGuard>
      <BranchFormModal
        open={isCreateOpen || Boolean(editingBranch)}
        onOpenChange={(open) => {
          if (!open) setEditingBranch(null);
          setIsCreateOpen(open);
        }}
        branch={editingBranch}
        onSuccess={handleSuccess}
      />

      {settingsBranch && (
        <BranchSettingsModal
          open={Boolean(settingsBranch)}
          onOpenChange={(open) => {
            if (!open) setSettingsBranch(null);
          }}
          branch={settingsBranch}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
