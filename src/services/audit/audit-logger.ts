import { DomainEvents, type DomainEvent } from "@/services/events/domain-events";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import type { AuditLogSchema } from "@/database/schema";

export class AuditLoggerService {
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Listen to administrative domain events
    const auditEvents = [
      "BRANCH_CREATED",
      "BRANCH_UPDATED",
      "BRANCH_DISABLED",
      "STAFF_CREATED",
      "STAFF_UPDATED",
      "STAFF_STATUS_CHANGED",
      "ROLE_CREATED",
      "ROLE_UPDATED",
      "ROLE_ASSIGNED",
      "PASSWORD_RESET_REQUESTED",
      "PERMISSION_CHANGED",
    ];

    auditEvents.forEach((eventName) => {
      DomainEvents.subscribe(eventName, (event) => this.handleDomainEvent(event));
    });
  }

  private static async handleDomainEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload || {};

    const auditEntry: AuditLogSchema = {
      id: crypto.randomUUID(),
      userId: String(event.userId || payload["userId"] || "system"),
      userName: String(payload["userName"] || "System Admin"),
      branchId: event.branchId || String(payload["branchId"] || ""),
      entity: String(payload["entity"] || event.name.split("_")[0] || "SYSTEM"),
      entityId: String(payload["entityId"] || payload["id"] || "N/A"),
      action: event.name,
      before: (payload["before"] as Record<string, unknown>) || null,
      after: (payload["after"] || payload["record"] || payload) as Record<string, unknown>,
      metadata: {
        timestamp: event.timestamp,
        source: "domain_event_bus",
      },
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
