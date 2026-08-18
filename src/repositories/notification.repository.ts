import { db } from "@/database/schema";
import type { NotificationsSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class NotificationRepository extends BaseRepository<NotificationsSchema> {
  constructor() {
    super("notifications", db.notifications);
  }

  /** Get notifications for a user (admin or staff), scoped to their active branch where relevant */
  async getForUser(userId: string, limit = 50, activeBranchId?: string): Promise<NotificationsSchema[]> {
    const all = await db.notifications.toArray();
    const filtered = all.filter((n) => {
      // Must match the user by direct assignment or be a broadcast
      const isForUser = !n.recipientUserId || n.recipientUserId === userId || n.recipientCustomerId === userId;
      if (!isForUser) return false;

      // Branch-scoped notifications (inventory, expiry): only show if branchId matches active branch
      // Notifications with no branchId (wholesale orders, customer-targeted) are always visible
      const nBranchId = n.branchId as string | undefined;
      if (nBranchId && activeBranchId && nBranchId !== activeBranchId) return false;

      return true;
    });
    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /** Get notifications for a wholesale customer */
  async getForCustomer(customerId: string, limit = 50): Promise<NotificationsSchema[]> {
    const all = await db.notifications.toArray();
    const filtered = all.filter(
      (n) => !n.recipientCustomerId || n.recipientCustomerId === customerId
    );
    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  /** Get unread notifications count for user or customer, scoped to active branch */
  async getUnreadCount(userId?: string, customerId?: string, activeBranchId?: string): Promise<number> {
    const all = await db.notifications.toArray();
    if (userId) {
      return all.filter((n) => {
        if (n.read) return false;
        const isForUser = !n.recipientUserId || n.recipientUserId === userId || n.recipientCustomerId === userId;
        if (!isForUser) return false;
        const nBranchId = n.branchId as string | undefined;
        if (nBranchId && activeBranchId && nBranchId !== activeBranchId) return false;
        return true;
      }).length;
    }
    if (customerId) {
      return all.filter(
        (n) => !n.read && (!n.recipientCustomerId || n.recipientCustomerId === customerId)
      ).length;
    }
    return 0;
  }

  /** Mark single notification as read */
  async markAsRead(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (existing && !existing.read) {
      await this.update(id, {
        read: true,
        readAt: Date.now(),
      });
    }
  }

  /** Mark all unread notifications as read for user or customer */
  async markAllAsRead(userId?: string, customerId?: string): Promise<number> {
    const all = await db.notifications.toArray();
    const unread = all.filter((n) => {
      if (n.read) return false;
      if (userId) {
        return !n.recipientUserId || n.recipientUserId === userId || n.recipientCustomerId === userId;
      }
      if (customerId) {
        return !n.recipientCustomerId || n.recipientCustomerId === customerId;
      }
      return true;
    });

    const now = Date.now();
    for (const item of unread) {
      await this.update(item.id, {
        read: true,
        readAt: now,
      });
    }
    return unread.length;
  }

  /** Check if a notification already exists for an entity & type (for deduplication) */
  async getByEntity(entityType: string, entityId: string, type: string): Promise<NotificationsSchema | undefined> {
    return db.notifications
      .filter((n) => n.entityType === entityType && n.entityId === entityId && n.type === type)
      .first();
  }
}

export const notificationRepository = new NotificationRepository();
