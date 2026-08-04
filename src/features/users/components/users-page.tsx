import { useEffect, useMemo, useState } from "react";
import { Shield, UserPlus, Edit2, Key, UserX, UserCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import { createStaffUser, sendStaffResetLink, deleteStaffUser } from "../staff.functions";
import { staffRepository, generateTemporaryPassword, type StaffCredentials } from "@/repositories/staff.repository";
import { branchRepository } from "@/repositories/branch.repository";
import { roleRepository } from "@/repositories/role.repository";
import { SyncScheduler } from "@/services/sync/sync-scheduler";
import type { BranchSchema, RoleSchema, StaffSchema } from "@/database/schema";
import { StaffFormModal } from "./staff-form-modal";
import { PermissionGuard } from "@/components/common/permission-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UsersPage() {
  const [staff, setStaff] = useState<StaffSchema[]>([]);
  const [branches, setBranches] = useState<BranchSchema[]>([]);
  const [roles, setRoles] = useState<RoleSchema[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffSchema | null>(null);
  const [passwordResetTarget, setPasswordResetTarget] = useState<StaffSchema | null>(null);
  const [deletingStaffTarget, setDeletingStaffTarget] = useState<StaffSchema | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Trigger sync catch-up and pull sync to reconcile remote changes
      await SyncScheduler.triggerSync();

      const [branchList, staffList, roleList] = await Promise.all([
        branchRepository.ensureSeedBranches(),
        staffRepository.getAll(),
        roleRepository.ensureSystemRoles(),
      ]);
      setBranches(branchList);
      setRoles(roleList);
      setStaff(staffList.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)));
    } catch (error) {
      console.error("[UsersPage] Failed to load staff, branches or roles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredStaff = useMemo(
    () => (filterBranchId ? staff.filter((member) => member.branchId === filterBranchId) : staff),
    [staff, filterBranchId],
  );

  const totals = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((member) => member.status === "active").length,
      suspended: staff.filter((member) => member.status === "suspended").length,
      deactivated: staff.filter((member) => member.status === "deactivated").length,
    }),
    [staff],
  );

  const resetPasswordFn = useServerFn(sendStaffResetLink);
  const createCredentialsFn = useServerFn(createStaffUser);
  const deleteStaffUserFn = useServerFn(deleteStaffUser);

  const [credentialTarget, setCredentialTarget] = useState<StaffSchema | null>(null);
  const [credentialResult, setCredentialResult] = useState<StaffCredentials | null>(null);
  const [isCreatingCredentials, setIsCreatingCredentials] = useState(false);

  const handleResetPassword = async (staffMember: StaffSchema) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("Offline: cannot send password reset link.");
      return;
    }

    setIsResetting(true);
    try {
      const response = await resetPasswordFn({
        data: {
          email: staffMember.email,
          redirectTo: `${window.location.origin}/auth?type=recovery`,
        },
      });
      setResetLink(response.actionLink ?? null);
    } catch (error) {
      console.error("[UsersPage] Password reset failed", error);
      toast.error("Failed to generate password reset link. Please try again.");
      setResetLink(null);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateCredentials = async (staffMember: StaffSchema) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("Offline: cannot create staff credentials.");
      return;
    }

    setIsCreatingCredentials(true);
    try {
      const temporaryPassword = generateTemporaryPassword();
      const response = await createCredentialsFn({
        data: {
          email: staffMember.email,
          password: temporaryPassword,
          fullName: `${staffMember.firstName} ${staffMember.lastName}`,
        },
      });

      await staffRepository.updateStaff(staffMember.id, {
        authUserId: response.authUserId,
      });

      setCredentialResult({
        employeeCode: staffMember.employeeCode ?? "",
        temporaryPassword,
        loginNote: `Created credentials for ${staffMember.firstName} ${staffMember.lastName}. Pass details securely.`,
      });
      toast.success("Credentials created successfully.");
      await loadData();
    } catch (error) {
      console.error("[UsersPage] Failed to create credentials:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create credentials.");
    } finally {
      setIsCreatingCredentials(false);
    }
  };

  const handleToggleStatus = async (member: StaffSchema) => {
    const nextStatus = member.status === "active" ? "deactivated" : "active";
    try {
      await staffRepository.setStaffStatus(member.id, nextStatus);
      toast.success(`Staff member set to ${nextStatus}.`);
      await loadData();
    } catch (err) {
      console.error("[UsersPage] Failed to change staff status:", err);
      toast.error("Failed to change staff status.");
    }
  };

  const handleDeleteStaff = async (member: StaffSchema) => {
    setIsDeleting(true);
    try {
      // 1. Delete remotely from Supabase if online
      if (typeof window !== "undefined" && navigator.onLine) {
        await deleteStaffUserFn({
          data: {
            authUserId: member.authUserId,
            staffId: member.id,
          },
        });
      }

      // 2. Delete locally in IndexedDB & enqueue sync
      await staffRepository.deleteStaff(member.id);
      toast.success(`User ${member.firstName} ${member.lastName} deleted.`);
      setDeletingStaffTarget(null);
      await loadData();
    } catch (err) {
      console.error("[UsersPage] Failed to delete user:", err);
      toast.error("Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSuccess = async (shouldClose = true) => {
    if (shouldClose) {
      setIsCreateOpen(false);
      setEditingStaff(null);
    }
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User & Staff Directory</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts, roles, branch assignments, and status.</p>
        </div>
        <PermissionGuard permission="staff:create">
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <UserPlus className="size-4" />
            Add Staff Member
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Total Staff
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">{totals.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All registered team members</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Active Users
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">{totals.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-500 font-medium">Operational & active</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Suspended
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">{totals.suspended}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-amber-500 font-medium">Access temporarily on hold</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Deactivated
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">{totals.deactivated}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-rose-500 font-medium">Inactive account status</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterBranchId} onValueChange={setFilterBranchId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Staff Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Employee Code</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => {
                const branch = branches.find((item) => item.id === member.branchId);
                return (
                  <tr key={member.id} className="border-t border-border/70 last:border-b">
                    <td className="px-6 py-4 align-top">
                      <div className="font-semibold text-foreground">{member.firstName} {member.lastName}</div>
                      {member.preferredName ? (
                        <div className="text-[11px] text-muted-foreground">{member.preferredName}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-muted-foreground">{member.email}</td>
                    <td className="px-6 py-4 align-top text-sm text-muted-foreground">{branch?.name ?? "Unassigned"}</td>
                    <td className="px-6 py-4 align-top text-sm text-muted-foreground">
                      {roles.find((role) => role.id === member.roleId || role.code === member.roleId || role.id === member.role || role.code === member.role)?.name ?? String(member.roleId ?? member.role ?? "Unassigned")}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-muted-foreground">{member.employeeCode ?? "—"}</td>
                    <td className="px-6 py-4 align-top">
                      <Badge variant={member.status === "active" ? "secondary" : "outline"} className="rounded-full px-2 py-1 text-[11px] uppercase tracking-[.18em]">
                        {member.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex justify-end gap-1">
                        <PermissionGuard permission="staff:update">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingStaff(member)} title="Edit Staff">
                            <Edit2 className="size-4" />
                          </Button>
                        </PermissionGuard>

                        <PermissionGuard permission="staff:update">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleToggleStatus(member)}
                            title={member.status === "active" ? "Deactivate User" : "Activate User"}
                          >
                            {member.status === "active" ? <UserX className="size-4 text-amber-500" /> : <UserCheck className="size-4 text-emerald-500" />}
                          </Button>
                        </PermissionGuard>

                        {member.authUserId ? (
                          <PermissionGuard permission="staff:update">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setPasswordResetTarget(member)}
                              title="Reset password"
                            >
                              <Key className="size-4" />
                            </Button>
                          </PermissionGuard>
                        ) : (
                          <PermissionGuard permission="staff:update">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setCredentialTarget(member)}
                              title="Create credentials"
                            >
                              <UserPlus className="size-4" />
                            </Button>
                          </PermissionGuard>
                        )}

                        <PermissionGuard permission="staff:delete">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeletingStaffTarget(member)}
                            title="Delete User"
                          >
                            <Trash2 className="size-4 text-rose-500" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredStaff.length && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading staff…" : "No staff members found for the current filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StaffFormModal
        open={isCreateOpen || Boolean(editingStaff)}
        onOpenChange={(open) => {
          if (!open) setEditingStaff(null);
          setIsCreateOpen(open);
        }}
        branches={branches}
        staff={editingStaff}
        onSuccess={handleSuccess}
      />

      {/* Delete User Confirmation Dialog */}
      <Dialog open={Boolean(deletingStaffTarget)} onOpenChange={(open) => !open && setDeletingStaffTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{deletingStaffTarget?.firstName} {deletingStaffTarget?.lastName}</span> ({deletingStaffTarget?.email})? This action will permanently remove the user locally and from Supabase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingStaffTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => deletingStaffTarget && handleDeleteStaff(deletingStaffTarget)}
            >
              {isDeleting ? "Deleting…" : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog
        open={Boolean(passwordResetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordResetTarget(null);
            setResetLink(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset staff password</DialogTitle>
            <DialogDescription>
              {resetLink
                ? "A recovery link has been generated. Share it securely with the staff member."
                : `Generate a recovery link for ${passwordResetTarget?.firstName} ${passwordResetTarget?.lastName}.`}
            </DialogDescription>
          </DialogHeader>

          {resetLink ? (
            <div className="space-y-4 py-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Recovery link</p>
                <p className="mt-2 break-all text-sm text-foreground">{resetLink}</p>
              </div>
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              This will create a password recovery link for the selected staff account.
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPasswordResetTarget(null);
                setResetLink(null);
              }}
            >
              Cancel
            </Button>
            {!resetLink ? (
              <Button
                type="button"
                disabled={isResetting || !passwordResetTarget}
                onClick={() => passwordResetTarget && handleResetPassword(passwordResetTarget)}
              >
                {isResetting ? "Generating…" : "Generate link"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setPasswordResetTarget(null);
                  setResetLink(null);
                }}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Credentials Dialog */}
      <Dialog
        open={Boolean(credentialTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialTarget(null);
            setCredentialResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create staff credentials</DialogTitle>
            <DialogDescription>
              {credentialResult
                ? "Temporary credentials are ready. Share them securely with the staff member."
                : `Create credentials for ${credentialTarget?.firstName} ${credentialTarget?.lastName}.`}
            </DialogDescription>
          </DialogHeader>

          {credentialResult ? (
            <div className="space-y-4 py-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Employee code</p>
                <p className="mt-2 text-lg font-semibold">{credentialResult.employeeCode}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Temporary password</p>
                <p className="mt-2 font-mono text-lg font-semibold">{credentialResult.temporaryPassword}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                {credentialResult.loginNote}
              </div>
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              This will create a Supabase auth user for the existing staff record and generate a temporary password.
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCredentialTarget(null);
                setCredentialResult(null);
              }}
            >
              Cancel
            </Button>
            {!credentialResult ? (
              <Button
                type="button"
                disabled={isCreatingCredentials || !credentialTarget}
                onClick={() => credentialTarget && handleCreateCredentials(credentialTarget)}
              >
                {isCreatingCredentials ? "Creating…" : "Create credentials"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setCredentialTarget(null);
                  setCredentialResult(null);
                }}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
