import { DomainEvents, type DomainEvent } from "@/services/events/domain-events";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import type { AuditLogSchema } from "@/database/schema";

export class AuditLoggerService {
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Listen to administrative and domain events across all modules
    const auditEvents = [
      // Auth / Access
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGOUT",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_CHANGED",

      // Admin & Security
      "BRANCH_CREATED",
      "BRANCH_UPDATED",
      "BRANCH_DISABLED",
      "STAFF_CREATED",
      "STAFF_UPDATED",
      "STAFF_STATUS_CHANGED",
      "ROLE_CREATED",
      "ROLE_UPDATED",
      "ROLE_ASSIGNED",
      "PERMISSION_CHANGED",

      // Products & Categories
      "PRODUCT_CREATED",
      "PRODUCT_UPDATED",
      "PRODUCT_ARCHIVED",
      "CATEGORY_CREATED",
      "CATEGORY_UPDATED",
      "PRICE_UPDATED",

      // Inventory Actions
      "OPENING_STOCK_SET",
      "STOCK_ADJUSTED",
      "STOCK_COUNT_COMPLETED",
      "SUPPLY_SENT",
      "SUPPLY_RECEIVED",
      "SUPPLY_CONFIRMED",
      "TRANSFER_CREATED",
      "TRANSFER_ACCEPTED",
      "TRANSFER_REJECTED",

      // Sales & Retail POS
      "SALE_CREATED",
      "SALE_COMPLETED",
      "SALE_VOIDED",
      "SALE_REPRINTED",
      "DISCOUNT_APPLIED",

      // Wholesale Orders
      "WHOLESALE_ORDER_CREATED",
      "WHOLESALE_ORDER_STATUS_CHANGED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_REJECTED",
      "INVOICE_GENERATED",

      // Customers
      "CUSTOMER_CREATED",
      "CUSTOMER_UPDATED",

      // Settings
      "SETTINGS_CHANGED",
      "RECEIPT_SETTINGS_CHANGED",
      "NOTIFICATION_SETTINGS_CHANGED",
      "LOW_STOCK_DEFAULT_CHANGED",
      "EMAIL_TEMPLATE_CHANGED",
      "AUDIT_EXPORTED",
    ];

    auditEvents.forEach((eventName) => {
      DomainEvents.subscribe(eventName, (event) => this.handleDomainEvent(event));
    });
  }

  private static deriveModule(eventName: string, entity: string): string {
    if (eventName.startsWith("LOGIN") || eventName.startsWith("LOGOUT") || eventName.includes("PASSWORD")) return "Authentication";
    if (eventName.startsWith("BRANCH")) return "Branches";
    if (eventName.startsWith("STAFF") || eventName.startsWith("ROLE") || eventName.startsWith("PERMISSION")) return "Staff & Security";
    if (eventName.startsWith("PRODUCT") || eventName.startsWith("CATEGORY") || eventName.startsWith("PRICE")) return "Products";
    if (eventName.startsWith("STOCK") || eventName.startsWith("SUPPLY") || eventName.startsWith("TRANSFER") || eventName.startsWith("OPENING")) return "Inventory";
    if (eventName.startsWith("SALE") || eventName.startsWith("DISCOUNT")) return "POS";
    if (eventName.startsWith("WHOLESALE") || eventName.startsWith("PAYMENT") || eventName.startsWith("INVOICE")) return "Wholesale";
    if (eventName.startsWith("CUSTOMER")) return "Customers";
    if (eventName.includes("SETTINGS") || eventName.includes("TEMPLATE") || eventName.includes("LOW_STOCK")) return "Settings";
    if (eventName.startsWith("AUDIT")) return "Audit";
    return entity || "System";
  }

  private static async handleDomainEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload || {};
    const entity = String(payload["entity"] || event.name.split("_")[0] || "SYSTEM");
    const moduleName = String(payload["module"] || this.deriveModule(event.name, entity));

    const auditEntry: AuditLogSchema = {
      id: crypto.randomUUID(),
      userId: String(event.userId || payload["userId"] || "system"),
      userName: String(payload["userName"] || payload["actorName"] || "System"),
      branchId: event.branchId || String(payload["branchId"] || ""),
      entity,
      entityId: String(payload["entityId"] || payload["id"] || "N/A"),
      module: moduleName,
      action: event.name,
      description: String(payload["description"] || payload["reason"] || `${event.name} performed on ${entity}`),
      before: (payload["before"] as Record<string, unknown>) || null,
      after: (payload["after"] || payload["record"] || payload) as Record<string, unknown>,
      metadata: {
        timestamp: event.timestamp,
        source: "domain_event_bus",
        ...(payload["metadata"] as Record<string, unknown> || {}),
      },
      ipAddress: String(payload["ipAddress"] || ""),
      device: String(payload["device"] || payload["userAgent"] || ""),
      timestamp: event.timestamp,
      synced: false,
    };

    try {
      await auditLogRepository.create(auditEntry);
    } catch (err) {
      console.error("[AuditLoggerService] Failed to record audit log:", err);
    }
  }
}
