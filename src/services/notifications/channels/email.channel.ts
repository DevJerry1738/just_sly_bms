import type { NotificationsSchema } from "@/database/schema";
import { notificationDeliveryRepository } from "@/repositories/notification-delivery.repository";

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ messageId: string }>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string): Promise<{ messageId: string }> {
    console.log(`[Email Dispatcher] Mock Send → To: ${to} | Subject: ${subject}`);
    return { messageId: `mock-email-${Date.now()}` };
  }
}

export class EmailChannel {
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    this.provider = provider || new ConsoleEmailProvider();
  }

  async dispatch(notification: NotificationsSchema, recipientEmail?: string): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const now = Date.now();

    if (!recipientEmail) {
      await notificationDeliveryRepository.create({
        id: deliveryId,
        notificationId: notification.id,
        channel: "email",
        status: "failed",
        errorMessage: "No email address found for recipient",
        attemptedAt: now,
        failedAt: now,
        sync_status: "pending",
      });
      return;
    }

    try {
      const result = await this.provider.send(
        recipientEmail,
        notification.title,
        `<div style="font-family: sans-serif; padding: 20px;"><h2>${notification.title}</h2><p>${notification.message}</p></div>`
      );

      await notificationDeliveryRepository.create({
        id: deliveryId,
        notificationId: notification.id,
        channel: "email",
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
        channel: "email",
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        attemptedAt: now,
        failedAt: now,
        sync_status: "pending",
      });
    }
  }
}

export const emailChannel = new EmailChannel();
