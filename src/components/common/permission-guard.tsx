import { type ReactNode } from "react";
import { useAuthorization } from "@/hooks/use-authorization";
import type { Permission } from "@/types/rbac";

interface PermissionGuardProps {
  /** The permission key required to render children */
  permission: Permission;
  /** Optional fallback to render if the check fails */
  fallback?: ReactNode;
  /** Children rendered when the user has the permission */
  children: ReactNode;
}

/**
 * PermissionGuard
 *
 * Conditionally renders children based on the current user's permissions.
 * Super admins always pass through. Regular users need the exact permission.
 *
 * @example
 * <PermissionGuard permission="branches:create">
 *   <CreateBranchButton />
 * </PermissionGuard>
 */
export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission } = useAuthorization();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
