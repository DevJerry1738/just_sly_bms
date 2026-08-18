import { db } from "@/database/schema";
import type { NotificationDeliverySchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class NotificationDeliveryRepository extends BaseRepository<NotificationDeliverySchema> {
  constructor() {
    super("notification_deliveries", db.notification_deliveries);
  }

  async getByNotificationId(notificationId: string): Promise<NotificationDeliverySchema[]> {
    return db.notification_deliveries
      .where("notificationId")
      .equals(notificationId)
      .toArray();
  }

  async getFailedDeliveries(limit = 50): Promise<NotificationDeliverySchema[]> {
    return db.notification_deliveries
      .where("status")
      .equals("failed")
      .limit(limit)
      .toArray();
  }
}

export const notificationDeliveryRepository = new NotificationDeliveryRepository();
