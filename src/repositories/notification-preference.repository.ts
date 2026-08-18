import { db } from "@/database/schema";
import type { NotificationPreferenceSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class NotificationPreferenceRepository extends BaseRepository<NotificationPreferenceSchema> {
  constructor() {
    super("notification_preferences", db.notification_preferences);
  }

  async getForUser(userId: string): Promise<NotificationPreferenceSchema[]> {
    return db.notification_preferences
      .where("userId")
      .equals(userId)
      .toArray();
  }

  async getForCustomer(customerId: string): Promise<NotificationPreferenceSchema[]> {
    return db.notification_preferences
      .where("customerId")
      .equals(customerId)
      .toArray();
  }

  async getCategoryPreference(
    recipient: { userId?: string; customerId?: string },
    category: string
  ): Promise<NotificationPreferenceSchema | undefined> {
    if (recipient.userId) {
      return db.notification_preferences
        .filter((p) => p.userId === recipient.userId && p.category === category)
        .first();
    }
    if (recipient.customerId) {
      return db.notification_preferences
        .filter((p) => p.customerId === recipient.customerId && p.category === category)
        .first();
    }
    return undefined;
  }
}

export const notificationPreferenceRepository = new NotificationPreferenceRepository();
