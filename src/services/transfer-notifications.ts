import { db } from "@/database/schema";
import { inventoryTransferRepository } from "@/repositories/inventory-transfer.repository";
import type { InventoryTransferSchema, TransferStatus } from "@/database/schema";

// ---------------------------------------------------------------------------
// Transfer Notification Service
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  transferId: string;
  transferNumber: string;
  transferType: string;
  event: string;
  sourceBranch: string;
  destinationBranch: string;
  createdBy?: string;
  recipients: string[]; // User IDs or emails
  branchIds?: string[];
  metadata?: Record<string, unknown>;
}

export class TransferNotificationService {
  /**
   * Generate notifications when transfer is created.
   */
  static async notifyTransferCreated(transfer: InventoryTransferSchema): Promise<void> {
    const recipients = await this.getRecipientsForBranch(transfer.sourceBranchId);

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_created",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      createdBy: transfer.createdBy,
      recipients,
      branchIds: [transfer.sourceBranchId],
    };

    await this.createNotification(payload);
  }

  /**
   * Generate notifications when transfer is dispatched.
   */
  static async notifyTransferDispatched(transfer: InventoryTransferSchema): Promise<void> {
    const sourceRecipients = await this.getRecipientsForBranch(transfer.sourceBranchId);
    const destRecipients = await this.getRecipientsForBranch(transfer.destinationBranchId);
    const recipients = [...new Set([...sourceRecipients, ...destRecipients])];

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_dispatched",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      recipients,
      branchIds: [transfer.sourceBranchId, transfer.destinationBranchId],
      metadata: {
        dispatchedAt: transfer.dispatchedAt,
      },
    };

    await this.createNotification(payload);
  }

  /**
   * Generate notifications when transfer is received/pending receipt.
   */
  static async notifyTransferPendingReceipt(transfer: InventoryTransferSchema): Promise<void> {
    const recipients = await this.getRecipientsForBranch(transfer.destinationBranchId);

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_pending_receipt",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      recipients,
      branchIds: [transfer.destinationBranchId],
      metadata: {
        expectedArrivalDate: transfer.expectedArrivalDate,
      },
    };

    await this.createNotification(payload);
  }

  /**
   * Generate notifications when transfer receipt is confirmed.
   */
  static async notifyTransferReceived(transfer: InventoryTransferSchema): Promise<void> {
    const sourceRecipients = await this.getRecipientsForBranch(transfer.sourceBranchId);
    const destRecipients = await this.getRecipientsForBranch(transfer.destinationBranchId);
    const recipients = [...new Set([...sourceRecipients, ...destRecipients])];

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_received",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      recipients,
      branchIds: [transfer.sourceBranchId, transfer.destinationBranchId],
      metadata: {
        receivedAt: transfer.receivedAt,
      },
    };

    await this.createNotification(payload);
  }

  /**
   * Generate notifications when transfer is rejected.
   */
  static async notifyTransferRejected(
    transfer: InventoryTransferSchema,
    reason?: string
  ): Promise<void> {
    const sourceRecipients = await this.getRecipientsForBranch(transfer.sourceBranchId);
    const destRecipients = await this.getRecipientsForBranch(transfer.destinationBranchId);
    const recipients = [...new Set([...sourceRecipients, ...destRecipients])];

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_rejected",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      recipients,
      branchIds: [transfer.sourceBranchId, transfer.destinationBranchId],
      metadata: {
        rejectedAt: transfer.rejectedAt,
        reason,
      },
    };

    await this.createNotification(payload);
  }

  /**
   * Generate notifications when transfer is cancelled.
   */
  static async notifyTransferCancelled(
    transfer: InventoryTransferSchema,
    reason?: string
  ): Promise<void> {
    const recipients = await this.getRecipientsForBranch(transfer.sourceBranchId);

    const payload: NotificationPayload = {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      transferType: transfer.transferType,
      event: "transfer_cancelled",
      sourceBranch: transfer.sourceBranchId,
      destinationBranch: transfer.destinationBranchId,
      recipients,
      branchIds: [transfer.sourceBranchId],
      metadata: {
        cancelledAt: transfer.cancelledAt,
        reason,
      },
    };

    await this.createNotification(payload);
  }

  /**
   * Create notifications in database.
   * In a full implementation, this would also send emails, SMS, etc.
   */
  private static async createNotification(payload: NotificationPayload): Promise<void> {
    const title = this.getNotificationTitle(payload.event, payload.transferType);
    const message = this.getNotificationMessage(payload);

    for (const recipient of payload.recipients) {
      const notification = {
        id: crypto.randomUUID(),
        userId: recipient,
        branchId: payload.branchIds?.[0] ?? payload.destinationBranch,
        branchIds: payload.branchIds,
        sourceBranchId: payload.sourceBranch,
        destinationBranchId: payload.destinationBranch,
        title,
        message,
        type: "transfer",
        read: false,
        metadata: {
          transferId: payload.transferId,
          transferNumber: payload.transferNumber,
          event: payload.event,
        },
        createdAt: Date.now(),
      } as Record<string, unknown>;

      await db.notifications.put(notification);
    }
  }

  /**
   * Get staff recipients for a branch.
   */
  private static async getRecipientsForBranch(branchId: string): Promise<string[]> {
    const staff = await db.staff.toArray();
    return staff
      .filter((s) => s.branchId === branchId && s.status === "active")
      .flatMap((s) => (s.authUserId ? [s.authUserId] : s.email ? [s.email] : []))
      .filter(Boolean) as string[];
  }

  /**
   * Generate notification title based on event.
   */
  private static getNotificationTitle(event: string, transferType: string): string {
    const typeLabel = transferType === "hq_supply" ? "Supply" : "Transfer";

    const titles: Record<string, string> = {
      transfer_created: `${typeLabel} Created`,
      transfer_dispatched: `${typeLabel} Dispatched`,
      transfer_pending_receipt: `${typeLabel} Pending Receipt`,
      transfer_received: `${typeLabel} Received`,
      transfer_rejected: `${typeLabel} Rejected`,
      transfer_cancelled: `${typeLabel} Cancelled`,
    };

    return titles[event] || "Transfer Update";
  }

  /**
   * Generate notification message based on event.
   */
  private static getNotificationMessage(payload: NotificationPayload): string {
    const messages: Record<string, string> = {
      transfer_created: `New ${payload.transferType === "hq_supply" ? "supply" : "transfer"} created: ${payload.transferNumber}`,
      transfer_dispatched: `${payload.transferNumber} has been dispatched from ${payload.sourceBranch}`,
      transfer_pending_receipt: `${payload.transferNumber} is pending receipt at ${payload.destinationBranch}`,
      transfer_received: `${payload.transferNumber} has been received and confirmed`,
      transfer_rejected: `${payload.transferNumber} was rejected: ${payload.metadata?.reason || "No reason provided"}`,
      transfer_cancelled: `${payload.transferNumber} has been cancelled: ${payload.metadata?.reason || "No reason provided"}`,
    };

    return messages[payload.event] || "Inventory transfer updated";
  }
}

export const transferNotificationService = new TransferNotificationService();
