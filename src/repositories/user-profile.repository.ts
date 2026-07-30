import { BaseRepository } from "./base.repository";
import { db, type UserProfileSchema } from "@/database/schema";

export class UserProfileRepository extends BaseRepository<UserProfileSchema> {
  constructor() {
    super("user_profiles", db.user_profiles);
  }

  async getByUserId(userId: string): Promise<UserProfileSchema | undefined> {
    return this.table.where("userId").equals(userId).first();
  }

  async getOrCreateForUser(userId: string, defaults: Partial<UserProfileSchema>): Promise<UserProfileSchema> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;

    const record: UserProfileSchema = {
      id: userId,
      userId,
      displayName: defaults.displayName ?? "",
      preferredName: defaults.preferredName ?? null,
      email: defaults.email ?? "",
      phone: defaults.phone ?? null,
      jobTitle: defaults.jobTitle ?? null,
      timezone: defaults.timezone ?? "UTC",
      language: defaults.language ?? "en",
      dateFormat: defaults.dateFormat ?? "DD/MM/YYYY",
      timeFormat: defaults.timeFormat ?? "24h",
      avatarUrl: defaults.avatarUrl ?? null,
      avatarFileName: defaults.avatarFileName ?? null,
      avatarUpdatedAt: defaults.avatarUpdatedAt ?? null,
      accountStatus: defaults.accountStatus ?? "active",
      role: defaults.role ?? "viewer",
      branch: defaults.branch ?? "Global",
      createdAt: defaults.createdAt ?? new Date().toISOString(),
      lastLogin: defaults.lastLogin ?? null,
      lastPasswordChange: defaults.lastPasswordChange ?? null,
      updatedAt: Date.now(),
      sync_status: "synced",
    };

    await this.table.put(record);
    return record;
  }

  async updateByUserId(userId: string, updates: Partial<UserProfileSchema>): Promise<UserProfileSchema> {
    const current = await this.getOrCreateForUser(userId, { userId, email: "" });
    const updated: UserProfileSchema = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
      sync_status: "pending",
    };

    await this.table.put(updated);
    await this.enqueueMutation("UPSERT", updated as unknown as Record<string, unknown>);
    return updated;
  }
}
