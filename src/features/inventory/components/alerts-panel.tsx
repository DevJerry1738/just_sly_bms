import React, { useState, useEffect } from "react";
import { AlertTriangle, PackageX, CheckCircle, Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { useAuth } from "@/providers/auth-provider";
import { db } from "@/database/schema";
import type { InventoryAlertSchema } from "@/database/schema";

interface TransferNotificationRecord {
  id: string;
  userId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  type: string;
  branchId?: string;
  branchIds?: string[];
  sourceBranchId?: string;
  destinationBranchId?: string;
  metadata?: Record<string, unknown>;
}

export function AlertsPanel({ branchId }: { branchId?: string }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InventoryAlertSchema[]>([]);
  const [notifications, setNotifications] = useState<TransferNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      // Run evaluation scan first
      await inventoryAlertRepository.generateExpiryAlerts();
      await inventoryAlertRepository.generateLowStockAlerts();

      const active = await inventoryAlertRepository.getActiveAlerts(branchId);
      let transferNotifications: TransferNotificationRecord[] = [];

      const allNotifications = await db.notifications.toArray();
      for (const n of allNotifications) {
        try {
          if (n.type !== "transfer") continue;

          const notification = n as TransferNotificationRecord;
          const meta = notification.metadata as Record<string, unknown> | undefined;
          const transferId = meta?.transferId as string | undefined;
          const isDirectUserMatch =
            user?.id && notification.userId === user.id;
          const isDirectEmailMatch =
            user?.email &&
            notification.userId?.toLowerCase() === user.email.toLowerCase();
          const isBranchTargeted =
            branchId &&
            (notification.branchId === branchId ||
              (Array.isArray(notification.branchIds) && notification.branchIds.includes(branchId)));

          if (isDirectUserMatch || isDirectEmailMatch || isBranchTargeted) {
            transferNotifications.push(notification);
            continue;
          }

          if (branchId && transferId) {
            const tr = await db.inventory_transfers.get(transferId);
            if (tr && tr.destinationBranchId === branchId) {
              transferNotifications.push(notification);
            }
          }
        } catch (err) {
          console.warn("Failed evaluating notification", n, err);
        }
      }

      transferNotifications.sort((a, b) => b.createdAt - a.createdAt);

      setAlerts(active);
      setNotifications(transferNotifications);
    } catch (err) {
      console.error("Failed loading inventory alerts", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [branchId, user?.id]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await inventoryAlertRepository.acknowledgeAlert(alertId, user?.id ?? "system", user?.displayName ?? user?.email);
      loadAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex justify-between items-center bg-muted/40 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">
            Alerts ({alerts.length} inventory / {notifications.length} transfers)
          </h3>
        </div>

        <Button variant="ghost" size="sm" onClick={loadAlerts}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh Scan
        </Button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-card">
          Scanning inventory for low stock and expiring batches...
        </div>
      ) : alerts.length === 0 && notifications.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-card">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          No active inventory alerts or transfer notifications.
        </div>
      ) : (
        <div className="space-y-6">
          {notifications.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold">Transfer Notifications</h4>
              </div>
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 rounded-xl border bg-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{notification.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                      </div>
                      <Badge variant={notification.read ? "secondary" : "outline"} className="uppercase text-[10px]">
                        {notification.read ? "Read" : "Unread"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const isExpired = alert.severity === "expired";
                const isCritical = alert.severity === "critical";

                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-4 rounded-xl border bg-card transition-colors ${
                      isExpired
                        ? "border-rose-500/50 bg-rose-500/5"
                        : isCritical
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isExpired ? (
                        <PackageX className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            isCritical ? "text-amber-500" : "text-blue-500"
                          }`}
                        />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{alert.message}</span>
                          <Badge
                            variant={isExpired ? "destructive" : "outline"}
                            className="capitalize text-[10px]"
                          >
                            {alert.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Recorded {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(alert.id)}
                      className="shrink-0"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Acknowledge
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
