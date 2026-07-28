import { SyncQueueService } from "@/services/sync/sync-queue";
import type { Table } from "dexie";
import type { SyncOperationType } from "@/services/sync/types";

export abstract class BaseRepository<T extends { id: string }> {
  protected constructor(
    protected entityName: string,
    protected table: Table<T, string>
  ) {}

  /**
   * Fetch all records from local IndexedDB.
   */
  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  /**
   * Fetch a single record by ID from local IndexedDB.
   */
  async getById(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  /**
   * Create a new record: stores locally in IndexedDB and enqueues CREATE mutation.
   */
  async create(data: Omit<T, "id"> & { id?: string }, branchId?: string): Promise<T> {
    const record = {
      ...data,
      id: data.id ?? crypto.randomUUID(),
      updatedAt: Date.now(),
    } as unknown as T;

    await this.table.put(record);
    await this.enqueueMutation("CREATE", record as unknown as Record<string, unknown>, branchId);
    return record;
  }

  /**
   * Update an existing record locally in IndexedDB and enqueue UPDATE mutation.
   */
  async update(id: string, updates: Partial<T>, branchId?: string): Promise<T> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`[Repository] ${this.entityName} with id "${id}" not found`);
    }

    const updatedRecord = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    } as T;

    await this.table.put(updatedRecord);
    await this.enqueueMutation("UPDATE", updatedRecord as unknown as Record<string, unknown>, branchId);
    return updatedRecord;
  }

  /**
   * Delete a record locally from IndexedDB and enqueue DELETE mutation.
   */
  async delete(id: string, branchId?: string): Promise<void> {
    await this.table.delete(id);
    await this.enqueueMutation("DELETE", { id }, branchId);
  }

  /**
   * Upsert a record locally in IndexedDB and enqueue UPSERT mutation.
   */
  async upsert(record: T, branchId?: string): Promise<T> {
    const recordToSave = {
      ...record,
      updatedAt: Date.now(),
    };

    await this.table.put(recordToSave);
    await this.enqueueMutation("UPSERT", recordToSave as unknown as Record<string, unknown>, branchId);
    return recordToSave;
  }

  /**
   * Enqueue mutation payload in SyncQueue.
   */
  protected async enqueueMutation(
    operationType: SyncOperationType,
    payload: Record<string, unknown>,
    branchId?: string
  ): Promise<void> {
    await SyncQueueService.enqueue(this.entityName, operationType, payload, { branchId });
  }
}
