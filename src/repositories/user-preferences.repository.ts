import { BaseRepository } from "./base.repository";
import { db, type UserPreferencesSchema } from "@/database/schema";

export class UserPreferencesRepository extends BaseRepository<UserPreferencesSchema> {
  constructor() {
    super("user_preferences", db.user_preferences);
  }

  async getByUserId(userId: string): Promise<UserPreferencesSchema | undefined> {
    return this.table.where("userId").equals(userId).first();
  }

  async getOrCreateForUser(userId: string, defaults: Partial<UserPreferencesSchema>): Promise<UserPreferencesSchema> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;

    const record: UserPreferencesSchema = {
      id: userId,
      userId,
      theme: defaults.theme ?? "system",
      compactMode: defaults.compactMode ?? false,
      tableDensity: defaults.tableDensity ?? "default",
      language: defaults.language ?? "en",
      notificationPreferences: defaults.notificationPreferences ?? true,
      updatedAt: Date.now(),
      sync_status: "synced",
    };

    await this.table.put(record);
    return record;
  }

  async updateByUserId(userId: string, updates: Partial<UserPreferencesSchema>): Promise<UserPreferencesSchema> {
    const current = await this.getOrCreateForUser(userId, { userId });
    const updated: UserPreferencesSchema = {
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
