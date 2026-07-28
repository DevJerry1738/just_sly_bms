export type SyncOperationType = "CREATE" | "UPDATE" | "DELETE" | "UPSERT";
export type SyncItemStatus = "pending" | "syncing" | "completed" | "failed";

export interface SyncQueueItem {
  id: string;
  entityType: string;
  operationType: SyncOperationType;
  payload: Record<string, unknown>;
  timestamp: number;
  status: SyncItemStatus;
  retryCount: number;
  priority: number;
  dependency?: string;
  createdBy?: string;
  branchId?: string;
  errorMessage?: string;
}

export type NetworkStatusType = "online" | "offline" | "connecting" | "reconnecting";

export interface NetworkStatusState {
  status: NetworkStatusType;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  unsyncedCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors?: Array<{ itemId: string; error: string }>;
}

export type EntitySyncHandler = (
  operation: SyncOperationType,
  payload: Record<string, unknown>
) => Promise<{ success: boolean; error?: string }>;
