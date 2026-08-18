import type { NotificationsSchema } from "@/database/schema";
import { notificationDeliveryRepository } from "@/repositories/notification-delivery.repository";

export interface WhatsAppProvider {
  sendTemplate(toPhone: string, templateName: string, params: Record<string, string>): Promise<{ messageId: string }>;
}

export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(toPhone: string, templateName: string, params: Record<string, string>): Promise<{ messageId: string }> {
    console.log(`[WhatsApp Dispatcher] Mock Template Send → To: ${toPhone} | Template: ${templateName}`, params);
    return { messageId: `mock-wa-${Date.now()}` };
  }
}

export class WhatsAppChannel {
  private provider: WhatsAppProvider;

  constructor(provider?: WhatsAppProvider) {
    this.provider = provider || new ConsoleWhatsAppProvider();
  }

  async dispatch(notification: NotificationsSchema, recipientPhone?: string): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const now = Date.now();

    if (!recipientPhone) {
      await notificationDeliveryRepository.create({
        id: deliveryId,
        notificationId: notification.id,
        channel: "whatsapp",
        status: "failed",
        errorMessage: "No phone number found for recipient",
        attemptedAt: now,
        failedAt: now,
        sync_status: "pending",
      });
      return;
    }

    try {
      const result = await this.provider.sendTemplate(recipientPhone, "operational_notification", {
        title: notification.title,
        message: notification.message,
      });

      await notificationDeliveryRepository.create({
        id: deliveryId,
        notificationId: notification.id,
        channel: "whatsapp",
        provider: "console",
        providerMessageId: result.messageId,
        status: "sent",
        attemptedAt: now,
        sentAt: now,
        sync_status: "pending",
      });
    } catch (err) {
      await notificationDeliveryRepository.create({
        id: deliveryId,
        notificationId: notification.id,
        channel: "whatsapp",
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        attemptedAt: now,
        failedAt: now,
        sync_status: "pending",
      });
    }
  }
}

export const whatsappChannel = new WhatsAppChannel();
