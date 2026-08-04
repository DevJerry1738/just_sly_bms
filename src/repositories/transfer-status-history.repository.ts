import { BaseRepository } from "./base.repository";
import { db, type TransferStatusHistorySchema, type TransferStatus } from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";

// ---------------------------------------------------------------------------
// TransferStatusHistoryRepository
// ---------------------------------------------------------------------------

export class TransferStatusHistoryRepository extends BaseRepository<TransferStatusHistorySchema> {
  constructor() {
    super("transfer_status_history", db.transfer_status_history);
  }

  /**
   * Record a status change for audit trail.
   */
  async recordStatusChange(
    transferId: string,
    toStatus: TransferStatus,
    changedBy: string,
    fromStatus?: TransferStatus,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<TransferStatusHistorySchema> {
    const now = Date.now();
    const record: TransferStatusHistorySchema = {
      id: crypto.randomUUID(),
      transferId,
      fromStatus,
      toStatus,
      changedBy,
      reason,
      metadata,
      timestamp: now,
    };

    await db.transfer_status_history.put(record);
    await SyncQueueService.enqueue(
      "transfer_status_history",
      "CREATE",
      record as unknown as Record<string, unknown>
    );

    return record;
  }

  /**
   * Get complete status history for a transfer.
   */
  async getHistory(transferId: string): Promise<TransferStatusHistorySchema[]> {
    return db.transfer_status_history
      .where("transferId")
      .equals(transferId)
      .reverse()
      .sortBy("timestamp");
  }

  /**
   * Get last status change for a transfer.
   */
  async getLastChange(transferId: string): Promise<TransferStatusHistorySchema | undefined> {
    const records = await db.transfer_status_history
      .where("transferId")
      .equals(transferId)
      .reverse()
      .sortBy("timestamp");
    return records[0];
  }

  /**
   * Get all transfers that changed to a specific status in a time range.
   */
  async getTransitionsByStatus(
    toStatus: TransferStatus,
    startTime?: number,
    endTime?: number
  ): Promise<TransferStatusHistorySchema[]> {
    let records = await db.transfer_status_history.toArray();

    records = records.filter((r) => r.toStatus === toStatus);

    if (startTime) {
      records = records.filter((r) => r.timestamp >= startTime);
    }

    if (endTime) {
      records = records.filter((r) => r.timestamp <= endTime);
    }

    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get the time taken for a transfer to reach a status.
   */
  async getTimeToStatus(transferId: string, targetStatus: TransferStatus): Promise<number | null> {
    const history = await this.getHistory(transferId);
    const first = history.find((h) => h.toStatus === targetStatus);
    const created = history[history.length - 1];

    if (!first || !created) return null;

    return first.timestamp - created.timestamp;
  }
}

export const transferStatusHistoryRepository = new TransferStatusHistoryRepository();
