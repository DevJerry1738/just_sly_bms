import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { userPermissionOverrideRepository } from "@/repositories/user-permission-override.repository";
import { staffRepository } from "@/repositories/staff.repository";
import { SyncScheduler } from "@/services/sync/sync-scheduler";
import { SyncManager } from "@/services/sync/sync-manager";
import { supabase } from "@/integrations/supabase/client";
import type { UserPermissionOverrideSchema } from "@/database/schema";
import {
  checkPermission,
  collectPermissions,
  ROLE_PERMISSIONS,
  PROTECTED_PERMISSIONS,
  type Permission,
  type RoleDefinition,
  type SystemRoleCode,
} from "@/types/rbac";
import type { AppRole } from "@/types/auth";

export type PermissionSource = "GRANT" | "DENY" | "ROLE" | "DEFAULT_DENY" | "PROTECTED";

// ---------------------------------------------------------------------------
// Map legacy AppRole -> RBAC RoleDefinition (bridge until DB roles are loaded)
// ---------------------------------------------------------------------------
const legacyRoleMap: Record<AppRole, SystemRoleCode> = {
  admin: "super_admin",
  manager: "branch_manager",
  staff: "sales_staff",
  viewer: "viewer",
};

function buildLegacyRoleDefinition(appRole: AppRole): RoleDefinition {
  const code = legacyRoleMap[appRole] ?? "viewer";
  return {
    id: `sys-${code}`,
    code,
    name: code
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `System role: ${code}`,
    isSystem: true,
    permissions: ROLE_PERMISSIONS[code as SystemRoleCode] ?? [],
  };
}

// ---------------------------------------------------------------------------
// useAuthorization hook
// ---------------------------------------------------------------------------
export interface AuthorizationHook {
  /** All effective permissions the current user holds */
  permissions: Permission[];
  /** Active individual permission overrides for current user */
  overrides: UserPermissionOverrideSchema[];
  /** Check if the user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if the user has any of the listed permissions */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Check if the user has all of the listed permissions */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Get resolution source of a permission for current user */
  getPermissionSource: (permission: Permission) => PermissionSource;
  /** Check if user can access a route (by required permission) */
  canAccessRoute: (requiredPermission?: Permission) => boolean;
  /** True if the user is a super admin (has settings:manage) */
  isSuperAdmin: boolean;
  /** True if the user is a branch manager */
  isBranchManager: boolean;
  /** Resolved RoleDefinition objects */
  roleDefinitions: RoleDefinition[];
  /** Current active branch id */
  activeBranchId: string | null;
  /** Refetch overrides from local database */
  refetchPermissions: () => Promise<void>;
}

export function useAuthorization(): AuthorizationHook {
  const { user, roles, isLoading } = useAuth();
  const { activeBranch } = useBranch();
  const [overrides, setOverrides] = useState<UserPermissionOverrideSchema[]>([]);

  const loadOverrides = useCallback(async () => {
    if (!user?.id && !user?.email) {
      setOverrides([]);
      return;
    }
    try {
      // Find matching local staff record to get staff.id if user.id is authUserId
      let staffId = user.id;
      let authUserId = user.id;
      let email = user.email ?? undefined;

      const staffRecord =
        (await staffRepository.getByAuthUserId(user.id)) ||
        (user.email ? await staffRepository.getByEmail(user.email) : undefined);

      if (staffRecord) {
        staffId = staffRecord.id;
        if (staffRecord.authUserId) authUserId = staffRecord.authUserId;
        if (staffRecord.email) email = staffRecord.email;
      }

      // Build all candidate identifiers (staff UUID, auth UUID, email)
      const candidateIds = Array.from(new Set([staffId, authUserId, email].filter(Boolean) as string[]));

      let userOverrides = await userPermissionOverrideRepository.getOverridesForUser(staffId, authUserId, email);

      // Fallback: if no local overrides found, query Supabase directly.
      // This handles fresh browser sessions where IndexedDB is not yet populated.
      if ((!userOverrides || userOverrides.length === 0) && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const { data: remoteOverrides } = await (supabase as any)
            .from("user_permission_overrides")
            .select("*")
            .in("user_id", candidateIds);

          if (remoteOverrides && remoteOverrides.length > 0) {
            // Write them into local IndexedDB for subsequent reads
            for (const rov of remoteOverrides) {
              await userPermissionOverrideRepository.upsertLocal({
                id: rov.id,
                organizationId: rov.organization_id || "org-default",
                userId: rov.user_id,
                permissionId: rov.permission_id,
                effect: rov.effect,
                reason: rov.reason ?? null,
                createdBy: rov.created_by || "system",
                createdAt: rov.created_at ? new Date(rov.created_at).getTime() : Date.now(),
                updatedAt: rov.updated_at ? new Date(rov.updated_at).getTime() : Date.now(),
                sync_status: "synced",
              });
            }
            userOverrides = remoteOverrides.map((rov: any) => ({
              id: rov.id,
              organizationId: rov.organization_id || "org-default",
              userId: rov.user_id,
              permissionId: rov.permission_id,
              effect: rov.effect,
              reason: rov.reason ?? null,
              createdBy: rov.created_by || "system",
              createdAt: rov.created_at ? new Date(rov.created_at).getTime() : Date.now(),
              updatedAt: rov.updated_at ? new Date(rov.updated_at).getTime() : Date.now(),
              sync_status: "synced" as const,
            }));
          }
        } catch (remoteErr) {
          console.warn("[useAuthorization] Supabase override fallback failed:", remoteErr);
        }
      }

      setOverrides(userOverrides || []);
    } catch (err) {
      console.error("[useAuthorization] Error loading overrides:", err);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    void loadOverrides();

    // Trigger background sync pull in parallel
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void SyncScheduler.triggerSync().catch(() => {});
    }

    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete" || event === "sync:pull:complete") {
        void loadOverrides();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadOverrides]);

  const effectiveRoles = useMemo<AppRole[]>(() => {
    if (roles.length > 0) return roles;
    return ["staff"];
  }, [roles]);

  const roleDefinitions = useMemo<RoleDefinition[]>(() => {
    if (isLoading) return [];
    return effectiveRoles.map((r) => buildLegacyRoleDefinition(r));
  }, [effectiveRoles, isLoading]);

  const rolePermissions = useMemo<Permission[]>(() => {
    return collectPermissions(roleDefinitions);
  }, [roleDefinitions]);

  const isSuperAdmin = useMemo(
    () => roles.includes("admin"),
    [roles]
  );

  const isBranchManager = useMemo(
    () => roles.includes("manager"),
    [roles]
  );

  /**
   * Calculate effective permissions by layering overrides on top of role defaults.
   * Priority:
   * 1. Super Admin -> All true
   * 2. Explicit DENY -> False
   * 3. Explicit GRANT -> True
   * 4. Role Permission -> True
   * 5. Default Deny -> False
   */
  const permissions = useMemo<Permission[]>(() => {
    const grantSet = new Set<Permission>();
    const denySet = new Set<Permission>();

    for (const ov of overrides) {
      if (ov.effect === "DENY") denySet.add(ov.permissionId as Permission);
      if (ov.effect === "GRANT") grantSet.add(ov.permissionId as Permission);
    }

    if (isSuperAdmin) {
      // Even Super Admin respects explicit DENY overrides if manually configured
      const adminPerms = new Set(rolePermissions);
      for (const d of denySet) {
        adminPerms.delete(d);
      }
      return Array.from(adminPerms);
    }

    const result = new Set<Permission>();

    // Add role permissions unless explicitly denied
    for (const p of rolePermissions) {
      if (!denySet.has(p)) {
        result.add(p);
      }
    }

    // Add explicitly granted permissions unless explicitly denied
    for (const g of grantSet) {
      if (!denySet.has(g)) {
        result.add(g);
      }
    }

    return Array.from(result);
  }, [rolePermissions, overrides, isSuperAdmin]);

  const getPermissionSource = useCallback(
    (permission: Permission): PermissionSource => {
      if (PROTECTED_PERMISSIONS.includes(permission) && !isSuperAdmin) {
        return "PROTECTED";
      }

      const override = overrides.find((o) => o.permissionId === permission);
      if (override?.effect === "DENY") return "DENY";
      if (override?.effect === "GRANT") return "GRANT";
      if (rolePermissions.includes(permission)) return "ROLE";
      return "DEFAULT_DENY";
    },
    [overrides, rolePermissions, isSuperAdmin]
  );

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isLoading) return false;

      // Check explicit override FIRST (Explicit DENY > Explicit GRANT > Super Admin > Role Defaults)
      const override = overrides.find((o) => o.permissionId === permission);
      if (override) {
        return override.effect === "GRANT";
      }

      if (isSuperAdmin) return true;

      return checkPermission(rolePermissions, permission);
    },
    [isLoading, isSuperAdmin, overrides, rolePermissions]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      if (isLoading) return false;
      if (isSuperAdmin) return true;
      return perms.some((p) => hasPermission(p));
    },
    [isLoading, isSuperAdmin, hasPermission]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      if (isLoading) return false;
      if (isSuperAdmin) return true;
      return perms.every((p) => hasPermission(p));
    },
    [isLoading, isSuperAdmin, hasPermission]
  );

  const canAccessRoute = useCallback(
    (requiredPermission?: Permission): boolean => {
      if (!requiredPermission) return true;
      return hasPermission(requiredPermission);
    },
    [hasPermission]
  );

  return {
    permissions,
    overrides,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionSource,
    canAccessRoute,
    isSuperAdmin,
    isBranchManager,
    roleDefinitions,
    activeBranchId: activeBranch?.id ?? null,
    refetchPermissions: loadOverrides,
  };
}
