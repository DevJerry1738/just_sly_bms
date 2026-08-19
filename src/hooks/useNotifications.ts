import { useState, useEffect, useCallback } from "react";
import type { NotificationsSchema } from "@/database/schema";
import { notificationRepository } from "@/repositories/notification.repository";
import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { runExpiryScanner } from "@/services/notifications/expiry-scanner";

export function useNotifications() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [notifications, setNotifications] = useState<NotificationsSchema[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const branchId = activeBranch?.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const items = await notificationRepository.getForUser(userId, 50, branchId);
      const count = await notificationRepository.getUnreadCount(userId, undefined, branchId);
      setNotifications(items);
      setUnreadCount(count);
    } catch (err) {
      console.warn("[useNotifications] Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, branchId]);

  useEffect(() => {
    refresh();

    // Periodic expiry scanner & notifications refresh
    runExpiryScanner().catch(() => {});
    const interval = setInterval(() => {
      refresh();
      runExpiryScanner().catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [refresh]);

  const markAsRead = async (id: string) => {
    if (!userId) return;
    await notificationRepository.markAsRead(id, userId, branchId);
    await refresh();
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await notificationRepository.markAllAsRead(userId, undefined, branchId);
    await refresh();
  };

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
