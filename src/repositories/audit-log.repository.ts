import { BaseRepository } from "./base.repository";
import { db, type AuditLogSchema } from "@/database/schema";

export class AuditLogRepository extends BaseRepository<AuditLogSchema> {
  constructor() {
    super("audit_logs", db.audit_logs);
  }

  async getRecentLogs(limit = 50): Promise<AuditLogSchema[]> {
    return db.audit_logs.orderBy("timestamp").reverse().limit(limit).toArray();
  }

  async getLogsByEntity(entity: string, entityId: string): Promise<AuditLogSchema[]> {
    return db.audit_logs
      .where("entity")
      .equals(entity)
      .filter((log) => log.entityId === entityId)
      .toArray();
  }
}

export const auditLogRepository = new AuditLogRepository();
