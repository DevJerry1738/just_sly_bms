import { BaseRepository } from "./base.repository";
import { db, type UserPermissionOverrideSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";
import type { Permission } from "@/types/rbac";

export class UserPermissionOverrideRepository extends BaseRepository<UserPermissionOverrideSchema> {
  constructor() {
    super("user_permission_overrides", db.user_permission_overrides);
  }

  private normalizeUserId(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private async resolveUserAliasIds(
    userId: string,
    additionalUserIds: string[] = []
  ): Promise<{ canonicalUserId: string; userIds: string[] }> {
    const candidateIds = Array.from(
      new Set([userId, ...additionalUserIds].filter((value): value is string => Boolean(this.normalizeUserId(value))))
    );

    if (candidateIds.length === 0) {
      return { canonicalUserId: userId, userIds: [] };
    }

    const allStaff = await db.staff.toArray();
    const aliasMap = new Map<string, string>();

    for (const staff of allStaff) {
      if (staff.id) aliasMap.set(staff.id, staff.authUserId ?? staff.id);
      if (staff.authUserId) aliasMap.set(staff.authUserId, staff.authUserId);
      if (staff.email) aliasMap.set(staff.email.toLowerCase(), staff.authUserId ?? staff.id);
    }

    const normalizedIds = new Set<string>();
    for (const candidate of candidateIds) {
      normalizedIds.add(this.normalizeUserId(candidate) as string);
      const mapped = aliasMap.get(candidate) ?? aliasMap.get(candidate.toLowerCase());
      if (mapped) normalizedIds.add(mapped);
    }

    const preferredAuthId = Array.from(normalizedIds).find((id) => {
      const staff = allStaff.find((member) => member.authUserId === id || member.id === id);
      return Boolean(staff?.authUserId);
    }) ?? Array.from(normalizedIds).find((id) => !id.includes("@")) ?? Array.from(normalizedIds)[0];

    const userIds = Array.from(normalizedIds);
    return {
      canonicalUserId: preferredAuthId ?? userId,
      userIds,
    };
  }

  private async dedupeUserOverrides(overrides: UserPermissionOverrideSchema[]): Promise<UserPermissionOverrideSchema[]> {
    const seen = new Map<string, UserPermissionOverrideSchema>();
    for (const override of overrides) {
      const key = override.permissionId;
      const existing = seen.get(key);
      if (!existing || override.updatedAt > existing.updatedAt) {
        seen.set(key, override);
      }
    }
    return Array.from(seen.values());
  }

  /** Get all active permission overrides for a specific user ID, authUserId, or email */
  async getOverridesForUser(userId: string, authUserId?: string, email?: string): Promise<UserPermissionOverrideSchema[]> {
    if (!userId && !authUserId && !email) return [];

    const keys = Array.from(
      new Set([userId, authUserId, email].filter((value): value is string => Boolean(this.normalizeUserId(value))))
    );

    const all = await db.user_permission_overrides.toArray();
    const matching = all.filter((ov) => keys.includes(ov.userId));
    return this.dedupeUserOverrides(matching);
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
    const { canonicalUserId, userIds } = await this.resolveUserAliasIds(userId, additionalUserIds);
    const now = Date.now();

    const conflictingRecords = await db.user_permission_overrides.toArray();
    const aliasMatches = conflictingRecords.filter(
      (record) => record.permissionId === permissionId && userIds.includes(record.userId)
    );

    for (const record of aliasMatches) {
      await db.user_permission_overrides.delete(record.id);
      await this.enqueueMutation("DELETE", { id: record.id } as Record<string, unknown>);
    }

    const existing = await db.user_permission_overrides
      .where("[userId+permissionId]")
      .equals([canonicalUserId, permissionId])
      .first();

    const record: UserPermissionOverrideSchema = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId,
      userId: canonicalUserId,
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

    await DomainEvents.publish(
      effect === "GRANT" ? "STAFF_PERMISSION_GRANTED" : "STAFF_PERMISSION_REVOKED",
      {
        entity: "UserPermissionOverride",
        entityId: record.id,
        userId: canonicalUserId,
        permissionId,
        effect,
        reason,
        createdBy,
        description: `Set ${permissionId} to ${effect} for user ${canonicalUserId}`,
      }
    );

    return record;
  }

  /** Remove an individual permission override (revert to INHERITED state) */
  async removeOverride(userId: string, permissionId: Permission, actorId?: string, additionalUserIds: string[] = []): Promise<void> {
    const { userIds } = await this.resolveUserAliasIds(userId, additionalUserIds);
    const matching = (await db.user_permission_overrides.toArray()).filter(
      (ov) => ov.permissionId === permissionId && userIds.includes(ov.userId)
    );

    for (const existing of matching) {
      await db.user_permission_overrides.delete(existing.id);
      await this.enqueueMutation("DELETE", { id: existing.id } as Record<string, unknown>);
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
    const { userIds } = await this.resolveUserAliasIds(userId, additionalUserIds);
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

  /** Upsert a permission override locally (no sync enqueue — for cache hydration from remote) */
  async upsertLocal(record: UserPermissionOverrideSchema): Promise<void> {
    const matchingStaff = (await db.staff.toArray()).find(
      (member) => member.id === record.userId || member.authUserId === record.userId
    );

    const normalizedRecord: UserPermissionOverrideSchema = {
      ...record,
      userId: matchingStaff?.authUserId ?? record.userId,
      updatedAt: record.updatedAt ?? Date.now(),
    };

    await db.user_permission_overrides.put(normalizedRecord);
  }

  /** Get all permission overrides in local IndexedDB */
  async getAll(): Promise<UserPermissionOverrideSchema[]> {
    return db.user_permission_overrides.toArray();
  }
}

export const userPermissionOverrideRepository = new UserPermissionOverrideRepository();
