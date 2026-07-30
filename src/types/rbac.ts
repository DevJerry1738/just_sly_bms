/**
 * RBAC Type System for Just Sly Business Suite
 *
 * Defines the complete permission matrix, system roles, and authorization helpers.
 * Every UI element and API call should be guarded using these types.
 */

// ---------------------------------------------------------------------------
// Resource Categories (mirrors permission_categories table)
// ---------------------------------------------------------------------------
export type PermissionCategory =
  | "dashboard"
  | "branches"
  | "staff"
  | "products"
  | "inventory"
  | "sales"
  | "customers"
  | "reports"
  | "notifications"
  | "audit_logs"
  | "settings";

// ---------------------------------------------------------------------------
// Actions available per resource
// ---------------------------------------------------------------------------
export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "export"
  | "print"
  | "manage";

// ---------------------------------------------------------------------------
// Canonical permission key: "resource:action" (e.g. "branches:create")
// ---------------------------------------------------------------------------
export type Permission = `${PermissionCategory}:${PermissionAction}`;

// ---------------------------------------------------------------------------
// Built-in system role codes (cannot be deleted)
// ---------------------------------------------------------------------------
export const SYSTEM_ROLE_CODES = [
  "super_admin",
  "branch_manager",
  "sales_staff",
  "inventory_staff",
  "viewer",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

// ---------------------------------------------------------------------------
// Full permission matrix: which permissions each system role has by default
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Record<SystemRoleCode, Permission[]> = {
  super_admin: [
    "dashboard:view",
    "branches:view",
    "branches:create",
    "branches:update",
    "branches:delete",
    "branches:manage",
    "staff:view",
    "staff:create",
    "staff:update",
    "staff:delete",
    "staff:manage",
    "products:view",
    "products:create",
    "products:update",
    "products:delete",
    "products:manage",
    "inventory:view",
    "inventory:create",
    "inventory:update",
    "inventory:approve",
    "inventory:manage",
    "sales:view",
    "sales:create",
    "sales:update",
    "sales:delete",
    "sales:approve",
    "sales:export",
    "sales:print",
    "customers:view",
    "customers:create",
    "customers:update",
    "customers:delete",
    "reports:view",
    "reports:export",
    "notifications:view",
    "notifications:manage",
    "audit_logs:view",
    "audit_logs:export",
    "settings:view",
    "settings:update",
    "settings:manage",
  ],

  branch_manager: [
    "dashboard:view",
    "branches:view",
    "branches:update",
    "staff:view",
    "staff:create",
    "staff:update",
    "products:view",
    "products:create",
    "products:update",
    "inventory:view",
    "inventory:create",
    "inventory:update",
    "inventory:approve",
    "sales:view",
    "sales:create",
    "sales:update",
    "sales:approve",
    "sales:print",
    "customers:view",
    "customers:create",
    "customers:update",
    "reports:view",
    "reports:export",
    "notifications:view",
    "audit_logs:view",
    "settings:view",
  ],

  sales_staff: [
    "dashboard:view",
    "products:view",
    "inventory:view",
    "sales:view",
    "sales:create",
    "sales:print",
    "customers:view",
    "customers:create",
    "customers:update",
    "notifications:view",
  ],

  inventory_staff: [
    "dashboard:view",
    "products:view",
    "products:create",
    "products:update",
    "inventory:view",
    "inventory:create",
    "inventory:update",
    "notifications:view",
  ],

  viewer: [
    "dashboard:view",
    "branches:view",
    "products:view",
    "inventory:view",
    "sales:view",
    "customers:view",
    "reports:view",
    "notifications:view",
  ],
};

// ---------------------------------------------------------------------------
// Type helpers for authorization engine
// ---------------------------------------------------------------------------
export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
}

export interface AuthorizationContext {
  userId: string;
  roles: RoleDefinition[];
  activeBranchId?: string | null;
}

/** Check if a list of permissions includes a specific permission */
export function checkPermission(
  userPermissions: Permission[],
  permission: Permission
): boolean {
  // Super admin shortcut: check if user has any super_admin permissions
  if (userPermissions.includes("settings:manage")) return true;
  return userPermissions.includes(permission);
}

/** Collect all unique permissions for a set of roles */
export function collectPermissions(roles: RoleDefinition[]): Permission[] {
  const all = new Set<Permission>();
  for (const role of roles) {
    for (const perm of role.permissions) {
      all.add(perm);
    }
  }
  return Array.from(all);
}
