import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { notificationsRepository } from "@/repositories/entity.repositories";
import type { InventoryAlertSchema } from "@/database/schema";

export class InventoryAlertService {
  /**
   * Run background scan for expiry and low stock alerts.
   * Creates inventory alert records and mirrors them into the notifications table for in-app display.
   */
  async runAlertScan(): Promise<{ expiryAlerts: number; lowStockAlerts: number }> {
    const expiryAlerts = await inventoryAlertRepository.generateExpiryAlerts();
    const lowStockAlerts = await inventoryAlertRepository.generateLowStockAlerts();

    const allNewAlerts = [...expiryAlerts, ...lowStockAlerts];

    // Push into in-app notifications
    for (const alert of allNewAlerts) {
      await this._mirrorToNotification(alert);
    }

    return {
      expiryAlerts: expiryAlerts.length,
      lowStockAlerts: lowStockAlerts.length,
    };
  }

  private async _mirrorToNotification(alert: InventoryAlertSchema): Promise<void> {
    const title =
      alert.severity === "expired"
        ? "Expired Stock Alert"
        : alert.severity === "critical"
        ? "Critical Inventory Alert"
        : "Inventory Warning";

    await notificationsRepository.create({
      id: crypto.randomUUID(),
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
    });
  }
}

export const inventoryAlertService = new InventoryAlertService();
