import type { SyncQueueItem } from "./types";

export type ConflictStrategyType =
  | "SERVER_WINS"
  | "CLIENT_WINS"
  | "TIMESTAMP_BASED"
  | "VERSION_BASED"
  | "BRANCH_RULES";

export interface ConflictResolutionContext<T = Record<string, unknown>> {
  localRecord: T | null;
  serverRecord: T | null;
  queueItem: SyncQueueItem;
}

export interface ConflictResolutionResult<T = Record<string, unknown>> {
  resolvedRecord: T;
  strategyUsed: ConflictStrategyType;
}

export class ConflictResolver {
  private static defaultStrategy: ConflictStrategyType = "SERVER_WINS";

  static setDefaultStrategy(strategy: ConflictStrategyType): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Extension point for resolving record conflicts during sync processing.
   */
  static resolve<T extends Record<string, unknown>>(
    context: ConflictResolutionContext<T>,
    strategy: ConflictStrategyType = this.defaultStrategy
  ): ConflictResolutionResult<T> {
    const { localRecord, serverRecord } = context;

    if (!localRecord) {
      return { resolvedRecord: serverRecord as T, strategyUsed: strategy };
    }
    if (!serverRecord) {
      return { resolvedRecord: localRecord as T, strategyUsed: strategy };
    }

    switch (strategy) {
      case "CLIENT_WINS":
        return { resolvedRecord: localRecord, strategyUsed: "CLIENT_WINS" };

      case "TIMESTAMP_BASED": {
        const localTime = (localRecord.updatedAt as number) || context.queueItem.timestamp;
        const serverTime = (serverRecord.updatedAt as number) || 0;
        const winner = localTime >= serverTime ? localRecord : serverRecord;
        return { resolvedRecord: winner, strategyUsed: "TIMESTAMP_BASED" };
      }

      case "VERSION_BASED": {
        const localVer = (localRecord.version as number) || 0;
        const serverVer = (serverRecord.version as number) || 0;
        const winner = localVer >= serverVer ? localRecord : serverRecord;
        return { resolvedRecord: winner, strategyUsed: "VERSION_BASED" };
      }

      case "SERVER_WINS":
      default:
        return { resolvedRecord: serverRecord, strategyUsed: "SERVER_WINS" };
    }
  }
}
