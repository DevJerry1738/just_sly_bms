import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import {
  checkPermission,
  collectPermissions,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_CODES,
  type Permission,
  type RoleDefinition,
  type SystemRoleCode,
} from "@/types/rbac";
import type { AppRole } from "@/types/auth";

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
  /** All permissions the current user holds */
  permissions: Permission[];
  /** Check if the user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if the user has any of the listed permissions */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Check if the user has all of the listed permissions */
  hasAllPermissions: (permissions: Permission[]) => boolean;
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
}

export function useAuthorization(): AuthorizationHook {
  const { roles, isLoading } = useAuth();
  const { activeBranch } = useBranch();

  const roleDefinitions = useMemo<RoleDefinition[]>(() => {
    if (isLoading || roles.length === 0) return [];
    return roles.map((r) => buildLegacyRoleDefinition(r));
  }, [roles, isLoading]);

  const permissions = useMemo<Permission[]>(() => {
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

  const hasPermission = (permission: Permission): boolean => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    return checkPermission(permissions, permission);
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    return perms.some((p) => checkPermission(permissions, p));
  };

  const hasAllPermissions = (perms: Permission[]): boolean => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    return perms.every((p) => checkPermission(permissions, p));
  };

  const canAccessRoute = (requiredPermission?: Permission): boolean => {
    if (!requiredPermission) return true;
    return hasPermission(requiredPermission);
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    isSuperAdmin,
    isBranchManager,
    roleDefinitions,
    activeBranchId: activeBranch?.id ?? null,
  };
}
