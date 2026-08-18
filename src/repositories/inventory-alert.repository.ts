import { BaseRepository } from "./base.repository";
import { db } from "@/database/schema";
import type {
  InventoryAlertSchema,
  AlertType,
  AlertSeverity,
} from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

function severityForAlertType(type: AlertType): AlertSeverity {
  switch (type) {
    case "expired": return "expired";
    case "expiring_7d": return "critical";
    case "expiring_30d": return "warning";
    case "expiring_60d": return "warning";
    case "expiring_90d": return "info";
    case "out_of_stock": return "critical";
    case "low_stock": return "warning";
    default: return "info";
  }
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export class InventoryAlertRepository extends BaseRepository<InventoryAlertSchema> {
  constructor() {
    super("inventory_alerts", db.inventory_alerts);
  }

  /** Generate (or refresh) expiry alerts from current batch data. Deduplicates by (productId, branchId, type, batchId). */
  async generateExpiryAlerts(): Promise<InventoryAlertSchema[]> {
    await this.removeDuplicateActiveAlerts();

    const batches = await db.inventory_batches
      .filter((b) => b.status === "active" && !!b.expiryDate)
      .toArray();

    const created: InventoryAlertSchema[] = [];
    const now = Date.now();

    for (const batch of batches) {
      if (!batch.expiryDate) continue;
      const days = daysUntil(batch.expiryDate);

      let type: AlertType | null = null;
      if (days < 0) type = "expired";
      else if (days <= 7) type = "expiring_7d";
      else if (days <= 30) type = "expiring_30d";
      else if (days <= 60) type = "expiring_60d";
      else if (days <= 90) type = "expiring_90d";

      if (!type) continue;

      // Dedup check: do not recreate the same alert if one already exists,
      // even if it has been acknowledged.
      const existing = await db.inventory_alerts
        .filter(
          (a) =>
            a.productId === batch.productId &&
            a.branchId === batch.branchId &&
            a.batchId === batch.id &&
            a.type === type
        )
        .first();
      if (existing) continue;

      const product = await db.products.get(batch.productId);
      const alert: InventoryAlertSchema = {
        id: crypto.randomUUID(),
        type,
        severity: severityForAlertType(type),
        productId: batch.productId,
        branchId: batch.branchId,
        batchId: batch.id,
        message: `${product?.name ?? "Product"} — Batch ${batch.batchNumber} ${
          days < 0
            ? `expired ${Math.abs(days)} day(s) ago`
            : `expires in ${days} day(s)`
        } (${batch.expiryDate})`,
        expiryDate: batch.expiryDate,
        daysRemaining: days,
        quantityAffected: batch.quantityOnHand,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdAt: now,
        updatedAt: now,
        sync_status: "pending",
      };

      await db.inventory_alerts.put(alert);
      await SyncQueueService.enqueue(
        "inventory_alerts",
        "CREATE",
        alert as unknown as Record<string, unknown>,
        { branchId: batch.branchId }
      );
      created.push(alert);
    }

    return created;
  }

  /** Generate low-stock / out-of-stock alerts from current balances. */
  async generateLowStockAlerts(): Promise<InventoryAlertSchema[]> {
    await this.removeDuplicateActiveAlerts();

    const balances = await db.inventory_balances.toArray();
    const products = await db.products.toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const created: InventoryAlertSchema[] = [];
    const now = Date.now();

    for (const balance of balances) {
      const product = productMap.get(balance.productId);
      if (!product || product.status !== "active") continue;

      const type: AlertType =
        balance.quantityOnHand <= 0 ? "out_of_stock" : "low_stock";

      if (
        type === "low_stock" &&
        balance.quantityOnHand >= product.lowStockThreshold
      )
        continue;

      const existing = await db.inventory_alerts
        .filter(
          (a) =>
            a.productId === balance.productId &&
            a.branchId === balance.branchId &&
            a.type === type
        )
        .first();
      if (existing) continue;

      const alert: InventoryAlertSchema = {
        id: crypto.randomUUID(),
        type,
        severity: severityForAlertType(type),
        productId: balance.productId,
        branchId: balance.branchId,
        batchId: null,
        message:
          type === "out_of_stock"
            ? `${product.name} is out of stock`
            : `${product.name} is running low — ${balance.quantityOnHand} ${balance.productId} remaining (threshold: ${product.lowStockThreshold})`,
        expiryDate: null,
        daysRemaining: null,
        quantityAffected: balance.quantityOnHand,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdAt: now,
        updatedAt: now,
        sync_status: "pending",
      };

      await db.inventory_alerts.put(alert);
      await SyncQueueService.enqueue(
        "inventory_alerts",
        "CREATE",
        alert as unknown as Record<string, unknown>,
        { branchId: balance.branchId }
      );
      created.push(alert);
    }

    return created;
  }

  private async removeDuplicateActiveAlerts(): Promise<void> {
    const activeAlerts = await db.inventory_alerts
      .filter((a) => !a.acknowledged)
      .toArray();

    const seen = new Map<string, InventoryAlertSchema>();
    const duplicates: string[] = [];

    for (const alert of activeAlerts) {
      const key = `${alert.productId}::${alert.branchId}::${alert.type}::${alert.batchId ?? "<none>"}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, alert);
        continue;
      }

      const keep = existing.createdAt >= alert.createdAt ? existing : alert;
      const remove = keep === existing ? alert : existing;

      seen.set(key, keep);
      duplicates.push(remove.id);
    }

    if (duplicates.length > 0) {
      await db.inventory_alerts.bulkDelete(duplicates);
    }
  }

  async acknowledgeAlert(alertId: string, userId: string, userName?: string): Promise<void> {
    const alert = await db.inventory_alerts.get(alertId);
    if (!alert) return;

    const updated: InventoryAlertSchema = {
      ...alert,
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: Date.now(),
      updatedAt: Date.now(),
      sync_status: "pending",
    };
    await db.inventory_alerts.put(updated);
    await SyncQueueService.enqueue(
      "inventory_alerts",
      "UPDATE",
      updated as unknown as Record<string, unknown>,
      { branchId: alert.branchId }
    );
    await DomainEvents.publish("INVENTORY_ALERT_ACKNOWLEDGED", {
      entity: "InventoryAlert",
      entityId: alertId,
      record: updated,
    });
  }

  async getActiveAlerts(branchId?: string): Promise<InventoryAlertSchema[]> {
    let results = await db.inventory_alerts
      .filter((a) => !a.acknowledged)
      .toArray();
    if (branchId) results = results.filter((a) => a.branchId === branchId);
    // Sort: expired first, then by severity, then by days remaining
    const severityOrder: Record<string, number> = { expired: 0, critical: 1, warning: 2, info: 3 };
    return results.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );
  }

  async getAlertCounts(branchId?: string): Promise<{
    expired: number;
    expiringSoon: number;
    lowStock: number;
    outOfStock: number;
  }> {
    const alerts = await this.getActiveAlerts(branchId);
    return {
      expired: alerts.filter((a) => a.type === "expired").length,
      expiringSoon: alerts.filter((a) =>
        ["expiring_7d", "expiring_30d", "expiring_60d", "expiring_90d"].includes(a.type)
      ).length,
      lowStock: alerts.filter((a) => a.type === "low_stock").length,
      outOfStock: alerts.filter((a) => a.type === "out_of_stock").length,
    };
  }
}

export const inventoryAlertRepository = new InventoryAlertRepository();
