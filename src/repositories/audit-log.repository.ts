import { BaseRepository } from "./base.repository";
import { db, type AuditLogSchema } from "@/database/schema";

export interface AuditLogFilters {
  dateFrom?: number;
  dateTo?: number;
  module?: string;
  userId?: string;
  branchId?: string;
  action?: string;
  search?: string;
}

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

  /**
   * Filter audit logs with multi-field search and pagination support
   */
  async queryLogs(filters: AuditLogFilters, limit = 100): Promise<AuditLogSchema[]> {
    const all = await db.audit_logs.orderBy("timestamp").reverse().toArray();

    return all.filter((log) => {
      if (filters.dateFrom && log.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && log.timestamp > filters.dateTo) return false;
      if (filters.module && filters.module !== "ALL" && log.module !== filters.module) return false;
      if (filters.userId && filters.userId !== "ALL" && log.userId !== filters.userId) return false;
      if (filters.branchId && filters.branchId !== "ALL" && log.branchId !== filters.branchId) return false;
      if (filters.action && filters.action !== "ALL" && log.action !== filters.action) return false;

      if (filters.search && filters.search.trim() !== "") {
        const q = filters.search.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesUser = (log.userName || "").toLowerCase().includes(q);
        const matchesEntity = log.entity.toLowerCase().includes(q) || log.entityId.toLowerCase().includes(q);
        const matchesDesc = (log.description || "").toLowerCase().includes(q);
        if (!matchesAction && !matchesUser && !matchesEntity && !matchesDesc) return false;
      }

      return true;
    }).slice(0, limit);
  }

  /** Get distinct modules for filter select options */
  async getModules(): Promise<string[]> {
    const all = await db.audit_logs.toArray();
    const modules = new Set<string>();
    all.forEach((log) => {
      if (log.module) modules.add(log.module);
    });
    return Array.from(modules).sort();
  }

  /** Get distinct users who performed audit actions */
  async getActors(): Promise<{ userId: string; userName: string }[]> {
    const all = await db.audit_logs.toArray();
    const map = new Map<string, string>();
    all.forEach((log) => {
      if (log.userId && !map.has(log.userId)) {
        map.set(log.userId, log.userName || log.userId);
      }
    });
    return Array.from(map.entries()).map(([userId, userName]) => ({ userId, userName }));
  }
}

export const auditLogRepository = new AuditLogRepository();
