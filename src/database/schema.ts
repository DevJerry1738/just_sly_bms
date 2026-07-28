import Dexie, { type Table } from "dexie";

export interface SyncQueueSchema {
  id: string;
  entityType: string;
  operationType: "CREATE" | "UPDATE" | "DELETE" | "UPSERT";
  payload: Record<string, unknown>;
  timestamp: number;
  status: "pending" | "syncing" | "completed" | "failed";
  retryCount: number;
  priority: number;
  dependency?: string;
  createdBy?: string;
  branchId?: string;
  errorMessage?: string;
}

export interface SyncMetadataSchema {
  id: string;
  entityType: string;
  lastSyncedAt: number;
}

export interface ProductSchema {
  id: string;
  sku: string;
  name: string;
  status: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface InventorySchema {
  id: string;
  productId: string;
  branchId: string;
  quantity: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface SalesSchema {
  id: string;
  branchId: string;
  status: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface OrdersSchema {
  id: string;
  branchId: string;
  status: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface CustomersSchema {
  id: string;
  email?: string;
  phone?: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface NotificationsSchema {
  id: string;
  read: boolean;
  createdAt: number;
  [key: string]: unknown;
}

export class JustSlyDatabase extends Dexie {
  syncQueue!: Table<SyncQueueSchema, string>;
  syncMetadata!: Table<SyncMetadataSchema, string>;
  products!: Table<ProductSchema, string>;
  inventory!: Table<InventorySchema, string>;
  sales!: Table<SalesSchema, string>;
  orders!: Table<OrdersSchema, string>;
  customers!: Table<CustomersSchema, string>;
  notifications!: Table<NotificationsSchema, string>;

  constructor() {
    super("JustSlySuiteDB");

    this.version(1).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, sku, name, status, updatedAt",
      inventory: "id, productId, branchId, quantity, updatedAt",
      sales: "id, branchId, status, createdAt",
      orders: "id, branchId, status, createdAt",
      customers: "id, email, phone, updatedAt",
      notifications: "id, read, createdAt",
    });
  }
}

export const db = new JustSlyDatabase();
