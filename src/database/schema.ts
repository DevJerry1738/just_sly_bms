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

export interface OrganizationSchema {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  registration_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  date_format?: string;
  logo_url?: string;
  primary_color?: string;
  receipt_header?: string;
  receipt_footer?: string;
  receipt_tax_note?: string;
  show_receipt_logo?: boolean;
  updated_at: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface UserProfileSchema {
  id: string;
  userId: string;
  displayName: string;
  preferredName: string | null;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  avatarUrl: string | null;
  avatarFileName: string | null;
  avatarUpdatedAt: number | null;
  accountStatus: string;
  role: string;
  branch: string;
  createdAt: string;
  lastLogin: string | null;
  lastPasswordChange: string | null;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface UserPreferencesSchema {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  tableDensity: "compact" | "comfortable" | "default";
  language: string;
  notificationPreferences: boolean;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface BranchSchema {
  id: string;
  code: string;
  name: string;
  organizationId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  receiptPrefix?: string;
  lowStockThreshold?: number;
  status: "active" | "inactive" | "temporarily_closed";
  managerId?: string;
  openingDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  syncVersion?: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface StaffSchema {
  id: string;
  authUserId?: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  branchId: string;
  roleId?: string;
  status: "active" | "suspended" | "deactivated";
  lastLogin?: number | null;
  employmentId?: string;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface RoleSchema {
  id: string;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  status: "active" | "disabled";
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface PermissionSchema {
  id: string;
  category: string;
  resource: string;
  action: string;
  description: string;
  [key: string]: unknown;
}

export interface RolePermissionSchema {
  id: string;
  roleId: string;
  permissionId: string;
  [key: string]: unknown;
}

export interface UserRoleSchema {
  id: string;
  userId: string;
  roleId: string;
  branchId?: string;
  assignedAt: number;
  expiresAt?: number | null;
  [key: string]: unknown;
}

export interface AuditLogSchema {
  id: string;
  userId: string;
  userName?: string;
  branchId?: string;
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  device?: string;
  timestamp: number;
  synced: boolean;
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
  organizations!: Table<OrganizationSchema, string>;
  user_profiles!: Table<UserProfileSchema, string>;
  user_preferences!: Table<UserPreferencesSchema, string>;
  branches!: Table<BranchSchema, string>;
  staff!: Table<StaffSchema, string>;
  roles!: Table<RoleSchema, string>;
  permissions!: Table<PermissionSchema, string>;
  role_permissions!: Table<RolePermissionSchema, string>;
  user_roles!: Table<UserRoleSchema, string>;
  audit_logs!: Table<AuditLogSchema, string>;

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

    this.version(2).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, sku, name, status, updatedAt",
      inventory: "id, productId, branchId, quantity, updatedAt",
      sales: "id, branchId, status, createdAt",
      orders: "id, branchId, status, createdAt",
      customers: "id, email, phone, updatedAt",
      notifications: "id, read, createdAt",
      organizations: "id, name, updated_at",
      user_profiles: "id, userId, displayName, email, updatedAt",
      user_preferences: "id, userId, theme, updatedAt",
    });

    this.version(3).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, sku, name, status, updatedAt",
      inventory: "id, productId, branchId, quantity, updatedAt",
      sales: "id, branchId, status, createdAt",
      orders: "id, branchId, status, createdAt",
      customers: "id, email, phone, updatedAt",
      notifications: "id, read, createdAt",
      organizations: "id, name, updated_at",
      user_profiles: "id, userId, displayName, email, updatedAt",
      user_preferences: "id, userId, theme, updatedAt",
      branches: "id, code, name, status, managerId, updatedAt",
      staff: "id, authUserId, employeeCode, email, branchId, status, updatedAt",
      roles: "id, code, name, status, isSystem",
      permissions: "id, category, resource, action",
      role_permissions: "id, roleId, permissionId",
      user_roles: "id, userId, roleId, branchId",
      audit_logs: "id, userId, branchId, entity, entityId, action, timestamp, synced",
    });
  }
}

export const db = new JustSlyDatabase();
