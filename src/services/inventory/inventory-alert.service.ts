import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { notificationsRepository } from "@/repositories/entity.repositories";
import { db } from "@/database/schema";
import type { InventoryAlertSchema } from "@/database/schema";

export class InventoryAlertService {
  /**
   * Run background scan for expiry and low stock alerts.
   * Creates inventory alert records and mirrors them into the notifications table for in-app display.
   */
  async runAlertScan(): Promise<{ expiryAlerts: number; lowStockAlerts: number }> {
    const expiryAlerts = await this.runExpiryScan();
    const lowStockAlerts = await inventoryAlertRepository.generateLowStockAlerts();
    await this.mirrorAlerts([...expiryAlerts, ...lowStockAlerts]);

    return {
      expiryAlerts: expiryAlerts.length,
      lowStockAlerts: lowStockAlerts.length,
    };
  }

  async runExpiryScan(): Promise<InventoryAlertSchema[]> {
    const expiryAlerts = await inventoryAlertRepository.generateExpiryAlerts();
    await this.mirrorAlerts(expiryAlerts);
    return expiryAlerts;
  }

  private async mirrorAlerts(alerts: InventoryAlertSchema[]): Promise<void> {
    for (const alert of alerts) {
      await this._mirrorToNotification(alert);
    }
  }

  private async _mirrorToNotification(alert: InventoryAlertSchema): Promise<void> {
    const notificationId = `inventory-alert:${alert.id}`;
    const existing = await db.notifications.get(notificationId);

    if (existing) return;

    const title =
      alert.severity === "expired"
        ? "Expired Stock Alert"
        : alert.severity === "critical"
        ? "Critical Inventory Alert"
        : "Inventory Warning";

    await notificationsRepository.create({
      id: notificationId,
      title,
      message: alert.message,
      type: alert.severity === "expired" || alert.severity === "critical" ? "error" : "warning",
      read: false,
      branchId: alert.branchId,
      metadata: {
        alertId: alert.id,
        productId: alert.productId,
        batchId: alert.batchId,
        alertType: alert.type,
      },
      createdAt: Date.now(),
    }, alert.branchId);
  }
}

export const inventoryAlertService = new InventoryAlertService();
