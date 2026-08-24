import { BaseRepository } from "./base.repository";
import { db, type UserPermissionOverrideSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";
import type { Permission } from "@/types/rbac";

export class UserPermissionOverrideRepository extends BaseRepository<UserPermissionOverrideSchema> {
  constructor() {
    super("user_permission_overrides", db.user_permission_overrides);
  }

  /** Get all active permission overrides for a specific user ID, authUserId, or email */
  async getOverridesForUser(userId: string, authUserId?: string, email?: string): Promise<UserPermissionOverrideSchema[]> {
    if (!userId && !authUserId && !email) return [];

    const keys = Array.from(new Set([userId, authUserId, email].filter(Boolean) as string[]));
    const all = await db.user_permission_overrides.toArray();
    return all.filter((ov) => keys.includes(ov.userId));
  }

  /** Set or update a permission override (GRANT or DENY) for a user */
  async setOverride(
    userId: string,
    permissionId: Permission,
    effect: "GRANT" | "DENY",
    reason?: string | null,
    createdBy?: string,
    organizationId: string = "org-default",
    additionalUserIds: string[] = []
  ): Promise<UserPermissionOverrideSchema> {
    const userIds = Array.from(new Set([userId, ...additionalUserIds].filter(Boolean)));
    const now = Date.now();
    let primaryRecord: UserPermissionOverrideSchema | null = null;

    for (const uid of userIds) {
      const existing = await db.user_permission_overrides
        .where("[userId+permissionId]")
        .equals([uid, permissionId])
        .first();

      const record: UserPermissionOverrideSchema = {
        id: existing?.id ?? crypto.randomUUID(),
        organizationId,
        userId: uid,
        permissionId,
        effect,
        reason: reason ?? null,
        createdBy: createdBy ?? "system",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        sync_status: "pending",
      };

      await db.user_permission_overrides.put(record);
      await this.enqueueMutation("UPSERT", record as unknown as Record<string, unknown>);
      if (!primaryRecord) primaryRecord = record;
    }

    await DomainEvents.publish(
      effect === "GRANT" ? "STAFF_PERMISSION_GRANTED" : "STAFF_PERMISSION_REVOKED",
      {
        entity: "UserPermissionOverride",
        entityId: primaryRecord?.id || crypto.randomUUID(),
        userId,
        permissionId,
        effect,
        reason,
        createdBy,
        description: `Set ${permissionId} to ${effect} for user ${userId}`,
      }
    );

    return primaryRecord!;
  }

  /** Remove an individual permission override (revert to INHERITED state) */
  async removeOverride(userId: string, permissionId: Permission, actorId?: string, additionalUserIds: string[] = []): Promise<void> {
    const userIds = Array.from(new Set([userId, ...additionalUserIds].filter(Boolean)));
    for (const uid of userIds) {
      const existing = await db.user_permission_overrides
        .where("[userId+permissionId]")
        .equals([uid, permissionId])
        .first();

      if (existing) {
        await db.user_permission_overrides.delete(existing.id);
        await this.enqueueMutation("DELETE", { id: existing.id } as Record<string, unknown>);
      }
    }

    await DomainEvents.publish("STAFF_PERMISSION_REVOKED", {
      entity: "UserPermissionOverride",
      entityId: userId,
      userId,
      permissionId,
      effect: "INHERITED",
      createdBy: actorId,
      description: `Removed override for ${permissionId} on user ${userId}`,
    });
  }

  /** Reset all individual permission overrides for a user (returns to pure role defaults) */
  async resetUserOverrides(userId: string, actorId?: string, additionalUserIds: string[] = []): Promise<number> {
    const userIds = Array.from(new Set([userId, ...additionalUserIds].filter(Boolean)));
    const all = await db.user_permission_overrides.toArray();
    const matching = all.filter((ov) => userIds.includes(ov.userId));
    if (matching.length === 0) return 0;

    for (const ov of matching) {
      await db.user_permission_overrides.delete(ov.id);
      await this.enqueueMutation("DELETE", { id: ov.id } as Record<string, unknown>);
    }

    await DomainEvents.publish("STAFF_PERMISSION_RESET", {
      entity: "UserPermissionOverride",
      entityId: userId,
      userId,
      count: matching.length,
      createdBy: actorId,
      description: `Reset ${matching.length} permission overrides for user ${userId}`,
    });

    return matching.length;
  }
}

export const userPermissionOverrideRepository = new UserPermissionOverrideRepository();
