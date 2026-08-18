import type { NotificationsSchema } from "@/database/schema";
import { notificationRepository } from "@/repositories/notification.repository";
import { notificationDeliveryRepository } from "@/repositories/notification-delivery.repository";

export class InAppChannel {
  async dispatch(notification: NotificationsSchema): Promise<void> {
    // Write notification record directly via repository
    await notificationRepository.create(notification);

    // Record delivery attempt
    await notificationDeliveryRepository.create({
      id: crypto.randomUUID(),
      notificationId: notification.id,
      channel: "in_app",
      status: "delivered",
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
      sync_status: "pending",
    });
  }
}

export const inAppChannel = new InAppChannel();
