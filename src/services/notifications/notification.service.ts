import type { NotificationsSchema } from "@/database/schema";
import { notificationRepository } from "@/repositories/notification.repository";
import { notificationPreferenceRepository } from "@/repositories/notification-preference.repository";
import type { NotificationEvent } from "./notification-events";
import { getNotificationContent } from "./notification-templates";
import { inAppChannel } from "./channels/in-app.channel";
import { emailChannel } from "./channels/email.channel";
import { whatsappChannel } from "./channels/whatsapp.channel";

export class NotificationService {
  /** Main entry point for dispatching a notification event */
  async notify(event: NotificationEvent): Promise<NotificationsSchema | null> {
    // Check deduplication for state/inventory alerts
    if (await this.isDuplicate(event)) {
      console.log(`[NotificationService] Suppressed duplicate notification for ${event.type}:${event.entityId}`);
      return null;
    }

    const { title, message } = getNotificationContent(event);
    const notificationId = crypto.randomUUID();
    const now = Date.now();

    const notification: NotificationsSchema = {
      id: notificationId,
      organizationId: event.organizationId,
      branchId: event.branchId,
      recipientUserId: event.targetUserId,
      recipientCustomerId: event.targetCustomerId,
      type: event.type,
      title,
      message,
      priority: event.priority,
      entityType: event.entityType,
      entityId: event.entityId,
      entityRoute: event.entityRoute,
      read: false,
      createdAt: now,
      sync_status: "pending",
    };

    // Determine category for preference check
    const category = this.getEventCategory(event.type);
    const recipient = { userId: event.targetUserId, customerId: event.targetCustomerId };

    // Check user notification preferences
    const pref = await notificationPreferenceRepository.getCategoryPreference(recipient, category);

    const allowInApp = pref ? pref.inApp : true;
    const allowEmail = pref ? pref.email : true;
    const allowWhatsApp = pref ? pref.whatsapp : false;

    // Dispatch to enabled channels
    if (allowInApp) {
      await inAppChannel.dispatch(notification);
    }

    if (allowEmail) {
      await emailChannel.dispatch(notification);
    }

    if (allowWhatsApp) {
      await whatsappChannel.dispatch(notification);
    }

    return notification;
  }

  /** Deduplication logic to prevent spam */
  private async isDuplicate(event: NotificationEvent): Promise<boolean> {
    if (!["low_stock", "expiry_warning", "expired_stock"].includes(event.type)) {
      return false;
    }

    const existing = await notificationRepository.getByEntity(event.entityType, event.entityId, event.type);
    if (!existing) return false;

    // Suppress if the same alert was fired within the last 24 hours (read or unread)
    const isRecent = Date.now() - existing.createdAt < 24 * 60 * 60 * 1000;
    return isRecent;
  }

  private getEventCategory(type: string): string {
    if (type.startsWith("order_") || type.startsWith("payment_") || type.startsWith("new_wholesale")) {
      return "order_updates";
    }
    if (type.includes("stock") || type.includes("expiry") || type.includes("expired")) {
      return "inventory_alerts";
    }
    return "branch_operations";
  }
}

export const notificationService = new NotificationService();
