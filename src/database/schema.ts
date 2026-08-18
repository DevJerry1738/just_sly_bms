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
  saleNumber: string;
  status: "draft" | "completed" | "voided" | "pending";
  paymentStatus: "pending" | "paid" | "partial";
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountTendered: number;
  currency: string;
  paymentMethod: "cash" | "bank_transfer" | "card" | "mixed";
  createdBy: string;
  createdByName?: string;
  completedAt?: number;
  voidedAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export interface SaleItemSchema {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  packagingLabel?: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
  createdAt: number;
  sync_status?: "synced" | "pending" | "error";
}

export interface SalePaymentSchema {
  id: string;
  saleId: string;
  method: "cash" | "bank_transfer" | "card";
  status: "pending" | "paid" | "failed";
  amount: number;
  reference?: string;
  createdAt: number;
  sync_status?: "synced" | "pending" | "error";
}

export interface SaleVoidSchema {
  id: string;
  saleId: string;
  reason: string;
  voidedBy: string;
  createdAt: number;
  inventoryReversed: boolean;
  sync_status?: "synced" | "pending" | "error";
}

export interface WholesaleOrderSchema {
  id: string;
  orderNumber: string;
  customerId: string;
  hqBranchId: string;
  status: WholesaleOrderStatus;
  paymentStatus: "pending" | "submitted" | "confirmed" | "rejected";
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
  [key: string]: unknown;
}

export type WholesaleOrderStatus =
  | "pending_payment"
  | "payment_submitted"
  | "payment_confirmed"
  | "processing"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface WholesaleOrderItemSchema {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  sellingUnit: string;
  unitsPerPackage: number;
  quantity: number;
  baseQuantity: number;
  unitPriceSnapshot: number;
  costPriceSnapshot: number;
  subtotal: number;
  createdAt: number;
  sync_status?: "synced" | "pending" | "error";
}

export interface OrderStatusHistorySchema {
  id: string;
  orderId: string;
  fromStatus?: string;
  toStatus: string;
  changedBy: string;
  reason?: string;
  timestamp: number;
}

export interface OrderPaymentSchema {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: number;
}

export interface PaymentReceiptSchema {
  id: string;
  orderId: string;
  fileName: string;
  bankName?: string;
  transferReference?: string;
  storagePath: string;
  uploadedAt: number;
}

export interface InvoiceSchema {
  id: string;
  orderId: string;
  invoiceNumber: string;
  amount: number;
  issuedAt: number;
}

export type CustomerAccountStatus = "active" | "inactive" | "suspended";

export interface CustomerAccountSchema {
  id: string;
  authUserId?: string;
  customerCode: string;
  businessName?: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  creditLimit?: number;
  status: CustomerAccountStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  sync_status: string;
  [key: string]: unknown;
}

export interface CustomersSchema {
  id: string;
  email?: string;
  phone?: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface NotificationPreferenceSchema {
  id: string;
  userId?: string;
  customerId?: string;
  category: string;
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  createdAt: number;
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
  /** Configurable product code prefix, e.g. "JSP". Defaults to "JSP" if not set. */
  product_code_prefix?: string;
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

// ---------------------------------------------------------------------------
// Sprint 3 — Product & Pricing Management
// ---------------------------------------------------------------------------

/** Unit of measure with decimal precision support for weighed/measured products */
export interface UnitOfMeasureSchema {
  id: string;
  name: string;             // e.g. "Kilogram"
  abbreviation: string;     // e.g. "kg"
  allowDecimals: boolean;   // whether fractional quantities are valid
  precision: number;        // decimal places (0 = integer only, 2 = 0.01, 3 = 0.001)
  isSystem: boolean;        // system-seeded; cannot be deleted
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Product category with optional hierarchy support */
export interface CategorySchema {
  id: string;
  code: string;             // Auto-generated, e.g. CAT-0001
  name: string;
  parentId?: string | null; // null = root category
  description?: string;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Full product schema replacing the Sprint 1/2 stub */
export interface ProductSchema {
  id: string;
  code: string;             // Auto-generated with org-configurable prefix, e.g. JSP-0001
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  brand?: string;
  baseUnit: string;         // ID or name of the UnitOfMeasure
  trackExpiry: boolean;
  expiryDate?: string;      // ISO date string (YYYY-MM-DD) if trackExpiry is true
  lowStockThreshold: number;
  costPrice: number | null;
  retailPrice: number;
  wholesalePrice: number;
  supplyPrice: number;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/**
 * Generic multi-level packaging.
 * Each row represents one packaging level for a product.
 * unitsPerPackage is ALWAYS relative to the base unit (not the previous level),
 * so conversion is always a single multiplication: qty × unitsPerPackage.
 *
 * Example for a 24-bottle carton:
 *   { label: "Pack",   unitsPerPackage: 6,   sortOrder: 1 }
 *   { label: "Carton", unitsPerPackage: 24,  sortOrder: 2 }
 *   { label: "Pallet", unitsPerPackage: 576, sortOrder: 3 }
 */
export interface ProductPackagingSchema {
  id: string;
  productId: string;
  label: string;            // e.g. "Carton", "Pack", "Crate", "Pallet"
  unitsPerPackage: number;  // always relative to base unit
  sortOrder: number;        // ascending: 1 = smallest packaging level
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Append-only pricing audit trail — never update or delete rows */
export interface PriceHistorySchema {
  id: string;
  productId: string;
  priceType: "cost" | "retail" | "wholesale" | "supply";
  previousPrice: number;
  newPrice: number;
  changedBy: string;         // userId
  changedByName?: string;
  reason?: string;
  timestamp: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Tracks status and results of an Excel bulk import job */
export interface ProductImportJobSchema {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  fileName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Sprint 4 — Inventory Management
// ---------------------------------------------------------------------------

/**
 * Transaction type enum — future-proof for Sales, Purchasing, Transfers.
 * Only opening_stock, stock_adjustment, manual_correction, stock_count
 * are implemented in Sprint 4; the rest are reserved placeholders.
 */
export type InventoryTransactionType =
  | "opening_stock"
  | "stock_adjustment"
  | "manual_correction"
  | "stock_count"
  | "sale"               // future
  | "purchase"           // future
  | "branch_transfer_in" // future
  | "branch_transfer_out"// future
  | "customer_return"    // future
  | "supplier_return"    // future
  | "damaged_stock"      // future
  | "expired_stock";     // future

/** Adjustment reason codes */
export type AdjustmentReason =
  | "stock_count_correction"
  | "damaged_goods"
  | "expired_goods"
  | "lost_stock"
  | "promotional_giveaway"
  | "manual_correction"
  | "other";

/**
 * Immutable ledger entry — every inventory movement creates one of these.
 * This is the source of truth; inventory_balances is derived/cached.
 * quantity is ALWAYS in base units (conversions happen before writing).
 */
export interface InventoryTransactionSchema {
  id: string;
  type: InventoryTransactionType;
  productId: string;
  branchId: string;
  quantity: number;            // signed (+/-) in base units
  baseUnit: string;            // snapshot of product.baseUnit at time of transaction
  unitCost: number | null;     // cost per base unit at time of transaction (FIFO snapshot)
  referenceNumber: string;     // auto-generated e.g. TXN-20240801-0001
  batchId?: string | null;     // linked batch if applicable
  sessionId?: string | null;   // linked stock count session if applicable
  notes?: string;
  performedBy: string;         // userId
  performedByName?: string;
  timestamp: number;           // ms since epoch
  sync_status?: "synced" | "pending" | "error";
}

/**
 * Cached current stock balance per product/branch.
 * Updated atomically every time a transaction is recorded.
 * Must NEVER be mutated directly — only via InventoryTransactionRepository.
 * valuationMethod is stored so future support for LIFO/WAC is non-breaking.
 */
export interface InventoryBalanceSchema {
  id: string;                  // composite: `${productId}::${branchId}`
  productId: string;
  branchId: string;
  quantityOnHand: number;      // base units, always ≥ 0 (floor at 0 for display)
  reservedQuantity: number;    // placeholder for future Sales reservation (always 0 for now)
  incomingQuantity: number;    // placeholder for future PO receiving (always 0 for now)
  valuationMethod: "fifo" | "lifo" | "weighted_avg"; // Sprint 4: always "fifo"
  totalCostValue: number;      // sum of (qty × unitCost) across FIFO layers
  weightedAvgCost: number;     // derived: totalCostValue / quantityOnHand (≥1)
  lastTransactionId: string;   // for optimistic conflict detection
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/**
 * A batch / lot of stock.
 * Products with trackExpiry=true MUST have a batch with an expiryDate.
 * FIFO allocation is driven by expiryDate ASC (soonest expiry = first out).
 */
export interface InventoryBatchSchema {
  id: string;
  batchNumber: string;         // e.g. BAT-20240801-0001
  productId: string;
  branchId: string;
  quantityOnHand: number;      // base units remaining in this batch
  initialQuantity: number;     // original quantity when batch was created
  manufactureDate?: string;    // ISO date YYYY-MM-DD
  expiryDate?: string;         // ISO date YYYY-MM-DD
  unitCost: number | null;     // cost per base unit for this batch (FIFO layer cost)
  supplierId?: string | null;  // future Purchasing link
  status: "active" | "depleted" | "expired" | "quarantined";
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/**
 * Structured adjustment detail — always paired with an InventoryTransaction.
 * Provides the reason code + freeform notes for audit purposes.
 */
export interface InventoryAdjustmentSchema {
  id: string;
  transactionId: string;       // FK → inventory_transactions.id
  productId: string;
  branchId: string;
  reason: AdjustmentReason;
  notes?: string;
  quantityBefore: number;      // balance before adjustment (base units)
  quantityAfter: number;       // balance after adjustment (base units)
  performedBy: string;
  performedByName?: string;
  timestamp: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Alert severity tiers for expiry and low-stock monitoring */
export type AlertSeverity = "info" | "warning" | "critical" | "expired";

/** Alert type */
export type AlertType =
  | "expiring_90d"
  | "expiring_60d"
  | "expiring_30d"
  | "expiring_7d"
  | "expired"
  | "low_stock"
  | "out_of_stock";

/**
 * In-app alert record linked to the notifications table.
 * One alert per (product, branch, type) — deduplicated on generation.
 */
export interface InventoryAlertSchema {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  productId: string;
  branchId: string;
  batchId?: string | null;     // present for expiry alerts
  message: string;
  expiryDate?: string | null;  // for expiry alerts
  daysRemaining?: number | null;
  quantityAffected?: number;   // qty in this batch or current balance
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/**
 * Epic 12 — Stock Count (Stock Take) session.
 * status transitions: draft → in_progress → pending_approval → approved → cancelled
 */
export type StockCountStatus =
  | "draft"
  | "in_progress"
  | "pending_approval"
  | "approved"
  | "cancelled";

export interface StockCountSessionSchema {
  id: string;
  sessionNumber: string;       // e.g. SC-20240801-0001
  branchId: string;
  status: StockCountStatus;
  scope: "full" | "partial";   // full = entire branch, partial = selected products
  snapshotAt: number;          // ms — when system balances were frozen as reference
  startedAt: number;
  completedAt?: number | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  cancelledAt?: number | null;
  cancelledBy?: string | null;
  notes?: string;
  totalVarianceValue: number;  // sum of |variance × unitCost| across all items
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/**
 * Individual product line within a stock count session.
 * systemQuantity is frozen at snapshotAt; countedQuantity is entered by staff.
 */
export interface StockCountItemSchema {
  id: string;
  sessionId: string;
  productId: string;
  productCode: string;         // snapshot
  productName: string;         // snapshot
  baseUnit: string;            // snapshot
  batchId?: string | null;     // if batch-tracked
  batchNumber?: string | null;
  expiryDate?: string | null;
  systemQuantity: number;      // frozen at session snapshot
  countedQuantity?: number | null; // null = not yet counted
  variance?: number | null;    // countedQuantity - systemQuantity
  unitCost: number;            // for variance value calculation
  varianceValue?: number | null; // variance × unitCost
  notes?: string;
  countedBy?: string | null;
  countedAt?: number | null;
  sync_status?: "synced" | "pending" | "error";
}

// ---------------------------------------------------------------------------
// Sprint 5 — Inventory Distribution & Branch Supply
// ---------------------------------------------------------------------------

export type TransferType = "hq_supply" | "branch_transfer";

export type TransferStatus =
  | "draft"
  | "pending_dispatch"
  | "dispatched"
  | "in_transit"
  | "pending_receipt"
  | "received"
  | "rejected"
  | "cancelled";

/** Core transfer document */
export interface InventoryTransferSchema {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  sourceBranchId: string;
  destinationBranchId: string;
  createdBy: string;
  status: TransferStatus;
  notes?: string;
  referenceDocumentNumber?: string;
  expectedArrivalDate?: string;
  createdAt: number;
  dispatchedAt?: number;
  receivedAt?: number;
  rejectedAt?: number;
  cancelledAt?: number;
  updatedAt: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Transfer line items */
export interface InventoryTransferItemSchema {
  id: string;
  transferId: string;
  productId: string;
  packagingUnit?: string;
  quantityInPackaging: number;
  convertedBaseQuantity: number;
  unitCostSnapshot: number | null;
  batchId?: string;
  manufactureDate?: string;
  expiryDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Batch allocations for transfers */
export interface InventoryTransferBatchSchema {
  id: string;
  transferItemId: string;
  batchId?: string;
  batchNumber: string;
  manufactureDate?: string;
  expiryDate?: string;
  quantityAllocated: number;
  createdAt: number;
}

/** Stock reservations (prevents overselling) */
export interface InventoryReservationSchema {
  id: string;
  productId: string;
  branchId: string;
  transferId?: string;
  quantityReserved: number;
  baseUnit: string;
  createdAt: number;
  releasedAt?: number;
  sync_status?: "synced" | "pending" | "error";
}

/** Transfer status change history */
export interface TransferStatusHistorySchema {
  id: string;
  transferId: string;
  fromStatus?: string;
  toStatus: string;
  changedBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Dexie Database Class
// ---------------------------------------------------------------------------

export class JustSlyDatabase extends Dexie {
  syncQueue!: Table<SyncQueueSchema, string>;
  syncMetadata!: Table<SyncMetadataSchema, string>;
  products!: Table<ProductSchema, string>;
  inventory!: Table<InventorySchema, string>;
  sales!: Table<SalesSchema, string>;
  sale_items!: Table<SaleItemSchema, string>;
  sale_payments!: Table<SalePaymentSchema, string>;
  sale_voids!: Table<SaleVoidSchema, string>;
  orders!: Table<OrdersSchema, string>;
  customers!: Table<CustomersSchema, string>;
  customer_accounts!: Table<CustomerAccountSchema, string>;
  notifications!: Table<NotificationsSchema, string>;
  notification_preferences!: Table<NotificationPreferenceSchema, string>;
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
  // Sprint 3
  units_of_measure!: Table<UnitOfMeasureSchema, string>;
  categories!: Table<CategorySchema, string>;
  product_packaging!: Table<ProductPackagingSchema, string>;
  price_history!: Table<PriceHistorySchema, string>;
  product_import_jobs!: Table<ProductImportJobSchema, string>;
  // Sprint 4
  inventory_transactions!: Table<InventoryTransactionSchema, string>;
  inventory_balances!: Table<InventoryBalanceSchema, string>;
  inventory_batches!: Table<InventoryBatchSchema, string>;
  inventory_adjustments!: Table<InventoryAdjustmentSchema, string>;
  inventory_alerts!: Table<InventoryAlertSchema, string>;
  stock_count_sessions!: Table<StockCountSessionSchema, string>;
  stock_count_items!: Table<StockCountItemSchema, string>;
  // Sprint 5
  inventory_transfers!: Table<InventoryTransferSchema, string>;
  inventory_transfer_items!: Table<InventoryTransferItemSchema, string>;
  inventory_transfer_batches!: Table<InventoryTransferBatchSchema, string>;
  inventory_reservations!: Table<InventoryReservationSchema, string>;
  transfer_status_history!: Table<TransferStatusHistorySchema, string>;
  // Sprint 7 Wholesale
  wholesale_orders!: Table<WholesaleOrderSchema, string>;
  wholesale_order_items!: Table<WholesaleOrderItemSchema, string>;
  order_status_history!: Table<OrderStatusHistorySchema, string>;
  order_payments!: Table<OrderPaymentSchema, string>;
  payment_receipts!: Table<PaymentReceiptSchema, string>;
  invoices!: Table<InvoiceSchema, string>;

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

    // Sprint 3 — Product & Pricing Management
    this.version(4).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      // Full product schema replacing stub (code + categoryId indexed)
      products: "id, code, sku, barcode, name, categoryId, status, updatedAt",
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
      // Sprint 3 new tables
      units_of_measure: "id, name, abbreviation, status, isSystem",
      categories: "id, code, name, status, parentId, updatedAt",
      product_packaging: "id, productId, sortOrder, updatedAt",
      price_history: "id, productId, priceType, changedBy, timestamp",
      product_import_jobs: "id, status, createdAt",
    });

    // Sprint 4 — Inventory Management
    this.version(5).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, code, sku, barcode, name, categoryId, status, updatedAt",
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
      // Sprint 3
      units_of_measure: "id, name, abbreviation, status, isSystem",
      categories: "id, code, name, status, parentId, updatedAt",
      product_packaging: "id, productId, sortOrder, updatedAt",
      price_history: "id, productId, priceType, changedBy, timestamp",
      product_import_jobs: "id, status, createdAt",
      // Sprint 4 new tables
      inventory_transactions: "id, productId, branchId, type, referenceNumber, batchId, sessionId, performedBy, timestamp",
      inventory_balances: "id, [productId+branchId], productId, branchId, updatedAt",
      inventory_batches: "id, productId, branchId, batchNumber, expiryDate, status, updatedAt",
      inventory_adjustments: "id, transactionId, productId, branchId, reason, timestamp",
      inventory_alerts: "id, type, severity, productId, branchId, batchId, acknowledged, createdAt",
      stock_count_sessions: "id, sessionNumber, branchId, status, startedAt",
      stock_count_items: "id, sessionId, productId, batchId",
    });

    // Sprint 5 — Inventory Distribution & Branch Supply
    this.version(6).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, code, sku, barcode, name, categoryId, status, updatedAt",
      inventory: "id, productId, branchId, quantity, updatedAt",
      sales: "id, branchId, saleNumber, status, createdAt",
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
      units_of_measure: "id, name, abbreviation, status, isSystem",
      categories: "id, code, name, status, parentId, updatedAt",
      product_packaging: "id, productId, sortOrder, updatedAt",
      price_history: "id, productId, priceType, changedBy, timestamp",
      product_import_jobs: "id, status, createdAt",
      inventory_transactions: "id, productId, branchId, type, referenceNumber, batchId, sessionId, performedBy, timestamp",
      inventory_balances: "id, [productId+branchId], productId, branchId, updatedAt",
      inventory_batches: "id, productId, branchId, batchNumber, expiryDate, status, updatedAt",
      inventory_adjustments: "id, transactionId, productId, branchId, reason, timestamp",
      inventory_alerts: "id, type, severity, productId, branchId, batchId, acknowledged, createdAt",
      stock_count_sessions: "id, sessionNumber, branchId, status, startedAt",
      stock_count_items: "id, sessionId, productId, batchId",
      // Sprint 5 new tables
      inventory_transfers: "id, transferNumber, transferType, sourceBranchId, destinationBranchId, status, createdBy, createdAt, updatedAt",
      inventory_transfer_items: "id, transferId, productId, batchId, createdAt",
      inventory_transfer_batches: "id, transferItemId, batchId, createdAt",
      inventory_reservations: "id, productId, branchId, transferId, createdAt, releasedAt",
      transfer_status_history: "id, transferId, timestamp",
    });

    this.version(7).stores({
      syncQueue: "id, entityType, operationType, status, priority, timestamp, retryCount",
      syncMetadata: "id, entityType, lastSyncedAt",
      products: "id, code, sku, barcode, name, categoryId, status, updatedAt",
      inventory: "id, productId, branchId, quantity, updatedAt",
      sales: "id, branchId, saleNumber, status, paymentStatus, createdAt",
      sale_items: "id, saleId, productId, createdAt",
      sale_payments: "id, saleId, method, status, createdAt",
      sale_voids: "id, saleId, voidedBy, createdAt",
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
      units_of_measure: "id, name, abbreviation, status, isSystem",
      categories: "id, code, name, status, parentId, updatedAt",
      product_packaging: "id, productId, sortOrder, updatedAt",
      price_history: "id, productId, priceType, changedBy, timestamp",
      product_import_jobs: "id, status, createdAt",
      inventory_transactions: "id, productId, branchId, type, referenceNumber, batchId, sessionId, performedBy, timestamp",
      inventory_balances: "id, [productId+branchId], productId, branchId, updatedAt",
      inventory_batches: "id, productId, branchId, batchNumber, expiryDate, status, updatedAt",
      inventory_adjustments: "id, transactionId, productId, branchId, reason, timestamp",
      inventory_alerts: "id, type, severity, productId, branchId, batchId, acknowledged, createdAt",
      stock_count_sessions: "id, sessionNumber, branchId, status, startedAt",
      stock_count_items: "id, sessionId, productId, batchId",
      inventory_transfers: "id, transferNumber, transferType, sourceBranchId, destinationBranchId, status, createdBy, createdAt, updatedAt",
      inventory_transfer_items: "id, transferId, productId, batchId, createdAt",
      inventory_transfer_batches: "id, transferItemId, batchId, createdAt",
      inventory_reservations: "id, productId, branchId, transferId, createdAt, releasedAt",
      transfer_status_history: "id, transferId, timestamp",
      wholesale_orders: "id, orderNumber, customerId, hqBranchId, status, paymentStatus, createdAt",
      wholesale_order_items: "id, orderId, productId, createdAt",
      order_status_history: "id, orderId, timestamp",
      order_payments: "id, orderId, status, createdAt",
      payment_receipts: "id, orderId, uploadedAt",
      invoices: "id, orderId, invoiceNumber, issuedAt",
    });
  }
}

const canUseIndexedDB =
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

function createNoOpTableProxy(): unknown {
  return new Proxy(
    {},
    {
      get(target, property) {
        if (property === "constructor") {
          return Object;
        }

        return () => {
          throw new Error(
            "IndexedDB is unavailable in this environment. Use getDb() only in browser runtime."
          );
        };
      },
    }
  );
}

function createNoOpDb(): JustSlyDatabase {
  return new Proxy(
    {},
    {
      get(target, property) {
        if (property === "constructor") {
          return JustSlyDatabase;
        }

        return createNoOpTableProxy();
      },
    }
  ) as unknown as JustSlyDatabase;
}

export const db: JustSlyDatabase = canUseIndexedDB
  ? new JustSlyDatabase()
  : createNoOpDb();

export function getDb(): JustSlyDatabase {
  if (!canUseIndexedDB) {
    throw new Error(
      "IndexedDB is unavailable in this environment. Use getDb() only in browser runtime."
    );
  }

  return db;
}
