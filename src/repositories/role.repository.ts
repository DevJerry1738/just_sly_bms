import { BaseRepository } from "./base.repository";
import { db, type RoleSchema, type PermissionSchema, type RolePermissionSchema, type UserRoleSchema } from "@/database/schema";
import {
  SYSTEM_ROLE_CODES,
  ROLE_PERMISSIONS,
  type SystemRoleCode,
  type Permission,
} from "@/types/rbac";
import { DomainEvents } from "@/services/events/domain-events";

// ---------------------------------------------------------------------------
// RoleRepository
// ---------------------------------------------------------------------------
export class RoleRepository extends BaseRepository<RoleSchema> {
  constructor() {
    super("roles", db.roles);
  }

  /** Seed all system roles + their permissions if the DB is empty */
  async ensureSystemRoles(): Promise<RoleSchema[]> {
    const existing = await this.getAll();
    if (existing.length > 0) return existing;

    const seedRoles: RoleSchema[] = [
      { id: "role-super-admin", name: "Super Admin", code: "super_admin", description: "Full system access. Cannot be modified.", isSystem: true, status: "active", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "role-branch-manager", name: "Branch Manager", code: "branch_manager", description: "Manages a single branch and its staff.", isSystem: true, status: "active", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "role-sales-staff", name: "Sales Staff", code: "sales_staff", description: "Processes sales and manages customers.", isSystem: true, status: "active", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "role-inventory-staff", name: "Inventory Staff", code: "inventory_staff", description: "Manages products and stock levels.", isSystem: true, status: "active", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "role-viewer", name: "Viewer", code: "viewer", description: "Read-only access to all modules.", isSystem: true, status: "active", createdAt: Date.now(), updatedAt: Date.now() },
    ];

    for (const role of seedRoles) {
      await db.roles.put(role);
    }

    // Seed permission records
    await this.seedPermissions(seedRoles);
    return seedRoles;
  }

  private async seedPermissions(roles: RoleSchema[]): Promise<void> {
    const existingPerms = await db.permissions.count();
    if (existingPerms > 0) return;

    const categories = ["dashboard", "branches", "staff", "products", "inventory", "sales", "customers", "reports", "notifications", "audit_logs", "settings"];
    const actions = ["view", "create", "update", "delete", "approve", "export", "print", "manage"];
    const permMap = new Map<string, PermissionSchema>();

    for (const category of categories) {
      for (const action of actions) {
        const key = `${category}:${action}` as Permission;
        const perm: PermissionSchema = {
          id: `perm-${category}-${action}`,
          category,
          resource: category,
          action,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${category.replace(/_/g, " ")}`,
        };
        permMap.set(key, perm);
        await db.permissions.put(perm);
      }
    }

    // Seed role_permissions
    for (const role of roles) {
      const roleCode = role.code as SystemRoleCode;
      const perms = ROLE_PERMISSIONS[roleCode] ?? [];
      for (const permKey of perms) {
        const perm = permMap.get(permKey);
        if (!perm) continue;
        const rp: RolePermissionSchema = {
          id: `rp-${role.id}-${perm.id}`,
          roleId: role.id,
          permissionId: perm.id,
        };
        await db.role_permissions.put(rp);
      }
    }
  }

  /** Get all permissions for a given role ID */
  async getRolePermissions(roleId: string): Promise<PermissionSchema[]> {
    const rps = await db.role_permissions.where("roleId").equals(roleId).toArray();
    const permIds = rps.map((rp) => rp.permissionId);
    return db.permissions.where("id").anyOf(permIds).toArray();
  }

  /** Create a custom role */
  async createRole(data: Partial<RoleSchema>): Promise<RoleSchema> {
    const existing = await this.getAll();
    const newRole: RoleSchema = {
      id: data.id ?? crypto.randomUUID(),
      name: data.name ?? "New Role",
      code: data.code ?? `custom_${existing.length + 1}`,
      description: data.description ?? "",
      isSystem: false,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saved = await this.create(newRole);
    await DomainEvents.publish("ROLE_CREATED", { entity: "Role", entityId: saved.id, record: saved });
    return saved;
  }

  /** Update role permissions by replacing the role_permissions entries */
  async updateRolePermissions(roleId: string, permissionKeys: Permission[]): Promise<void> {
    // Remove existing
    const existing = await db.role_permissions.where("roleId").equals(roleId).toArray();
    for (const rp of existing) {
      await db.role_permissions.delete(rp.id);
    }
    // Add new
    for (const key of permissionKeys) {
      const [resource, action] = key.split(":");
      const perm = await db.permissions
        .where("resource")
        .equals(resource)
        .filter((p) => p.action === action)
        .first();
      if (!perm) continue;
      await db.role_permissions.put({
        id: `rp-${roleId}-${perm.id}`,
        roleId,
        permissionId: perm.id,
      });
    }
    await DomainEvents.publish("PERMISSION_CHANGED", { entity: "Role", entityId: roleId, permissions: permissionKeys });
  }
}

// ---------------------------------------------------------------------------
// UserRoleRepository
// ---------------------------------------------------------------------------
export class UserRoleRepository extends BaseRepository<UserRoleSchema> {
  constructor() {
    super("user_roles", db.user_roles);
  }

  async getRolesForUser(userId: string): Promise<UserRoleSchema[]> {
    return db.user_roles.where("userId").equals(userId).toArray();
  }

  async assignRole(userId: string, roleId: string, branchId?: string): Promise<UserRoleSchema> {
    const existing = await db.user_roles
      .where("userId")
      .equals(userId)
      .filter((ur) => ur.roleId === roleId)
      .first();
    if (existing) return existing;

    const ur: UserRoleSchema = {
      id: crypto.randomUUID(),
      userId,
      roleId,
      branchId,
      assignedAt: Date.now(),
      expiresAt: null,
    };
    await db.user_roles.put(ur);
    await DomainEvents.publish("ROLE_ASSIGNED", { entity: "UserRole", entityId: ur.id, userId, roleId, branchId });
    return ur;
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const existing = await db.user_roles
      .where("userId")
      .equals(userId)
      .filter((ur) => ur.roleId === roleId)
      .first();
    if (existing) {
      await db.user_roles.delete(existing.id);
    }
  }
}

export const roleRepository = new RoleRepository();
export const userRoleRepository = new UserRoleRepository();
