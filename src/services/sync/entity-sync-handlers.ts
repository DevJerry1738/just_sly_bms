import { SyncManager } from "./sync-manager";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/database/schema";

const client = supabase as any;

function toCleanUuidOrNull(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function toCleanStringOrNull(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// 1. Branches Handler
SyncManager.registerHandler("branches", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("branches").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    code: payload["code"],
    name: payload["name"],
    organization_id: toCleanStringOrNull(payload["organizationId"]),
    email: toCleanStringOrNull(payload["email"]),
    phone: toCleanStringOrNull(payload["phone"]),
    address: toCleanStringOrNull(payload["address"]),
    city: toCleanStringOrNull(payload["city"]),
    state: toCleanStringOrNull(payload["state"]),
    country: payload["country"] || "Nigeria",
    timezone: payload["timezone"] || "Africa/Lagos",
    currency: payload["currency"] || "NGN",
    receipt_prefix: toCleanStringOrNull(payload["receiptPrefix"]),
    low_stock_threshold: payload["lowStockThreshold"] ?? 10,
    status: payload["status"] || "active",
    opening_date: toCleanStringOrNull(payload["openingDate"]),
    notes: toCleanStringOrNull(payload["notes"]),
    manager_id: toCleanUuidOrNull(payload["managerId"]),
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("branches").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.branches.update(payload["id"] as string, { sync_status: "synced" });
  } else {
    console.error("[Sync] Branches upsert error:", error.message);
  }
  return { success: !error, error: error?.message };
});

// 2. Staff Handler
SyncManager.registerHandler("staff", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("staff").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    auth_user_id: toCleanUuidOrNull(payload["authUserId"]),
    employee_code: payload["employeeCode"],
    first_name: payload["firstName"],
    last_name: payload["lastName"],
    email: payload["email"],
    phone: toCleanStringOrNull(payload["phone"]),
    role: payload["roleId"] || payload["role"] || "staff",
    branch_id: toCleanStringOrNull(payload["branchId"]),
    status: payload["status"] || "active",
    hire_date: toCleanStringOrNull(payload["hireDate"]),
    termination_date: toCleanStringOrNull(payload["terminationDate"]),
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("staff").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.staff.update(payload["id"] as string, { sync_status: "synced" });
  } else {
    console.error("[Sync] Staff upsert error:", error.message);
  }
  return { success: !error, error: error?.message };
});

// 3. Products Handler
SyncManager.registerHandler("products", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("products").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    sku:
      toCleanStringOrNull(payload["sku"]) ||
      toCleanStringOrNull(payload["code"]) ||
      (typeof payload["id"] === "string" ? payload["id"] : ""),
    name: payload["name"],
    description: toCleanStringOrNull(payload["description"]),
    category_id: toCleanStringOrNull(payload["categoryId"]),
    category_name: toCleanStringOrNull(payload["categoryName"]),
    unit: payload["unit"] || "pcs",
    cost_price: payload["costPrice"] ?? 0,
    selling_price: payload["sellingPrice"] ?? payload["retailPrice"] ?? 0,
    wholesale_price: payload["wholesalePrice"] ?? 0,
    min_order_quantity: payload["minOrderQuantity"] ?? 1,
    status: payload["status"] || "active",
    barcode: toCleanStringOrNull(payload["barcode"]),
    tags: payload["tags"] || [],
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("products").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.products.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// Product Packaging Handler
SyncManager.registerHandler("product_packaging", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("product_packaging").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    product_id: payload["productId"],
    label: payload["label"],
    units_per_package: payload["unitsPerPackage"],
    sort_order: payload["sortOrder"] ?? 0,
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("product_packaging").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.product_packaging.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// 4. Inventory Handler (Stub legacy table)
SyncManager.registerHandler("inventory", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("inventory").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    quantity: payload["quantity"] ?? 0,
    reorder_point: payload["reorderPoint"] ?? 5,
    last_stock_count_at: payload["lastStockCountAt"] ? new Date(Number(payload["lastStockCountAt"])).toISOString() : null,
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory").upsert(remoteRecord, { onConflict: "id" });
  return { success: !error, error: error?.message };
});

// ---------------------------------------------------------------------------
// Sprint 4 Handlers
// ---------------------------------------------------------------------------

// 5. Inventory Transactions Handler (Append-only)
SyncManager.registerHandler("inventory_transactions", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    type: payload["type"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    quantity: payload["quantity"],
    base_unit: payload["baseUnit"],
    unit_cost: payload["unitCost"],
    reference_number: payload["referenceNumber"],
    batch_id: toCleanStringOrNull(payload["batchId"]),
    session_id: toCleanStringOrNull(payload["sessionId"]),
    notes: toCleanStringOrNull(payload["notes"]),
    performed_by: payload["performedBy"],
    performed_by_name: toCleanStringOrNull(payload["performedByName"]),
    timestamp: new Date(Number(payload["timestamp"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory_transactions").insert(remoteRecord);
  if (!error || error.code === "23505") { // 23505 = duplicate primary key (idempotent)
    await db.inventory_transactions.update(payload["id"] as string, { sync_status: "synced" });
    return { success: true };
  }
  return { success: false, error: error?.message };
});

// 6. Inventory Balances Handler
SyncManager.registerHandler("inventory_balances", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    quantity_on_hand: payload["quantityOnHand"] ?? 0,
    reserved_quantity: payload["reservedQuantity"] ?? 0,
    incoming_quantity: payload["incomingQuantity"] ?? 0,
    valuation_method: payload["valuationMethod"] || "fifo",
    total_cost_value: payload["totalCostValue"] ?? 0,
    weighted_avg_cost: payload["weightedAvgCost"] ?? 0,
    last_transaction_id: payload["lastTransactionId"] || "",
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory_balances").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.inventory_balances.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// 7. Inventory Batches Handler
SyncManager.registerHandler("inventory_batches", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("inventory_batches").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    batch_number: payload["batchNumber"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    quantity_on_hand: payload["quantityOnHand"] ?? 0,
    initial_quantity: payload["initialQuantity"] ?? 0,
    manufacture_date: toCleanStringOrNull(payload["manufactureDate"]),
    expiry_date: toCleanStringOrNull(payload["expiryDate"]),
    unit_cost: payload["unitCost"] ?? 0,
    supplier_id: toCleanStringOrNull(payload["supplierId"]),
    status: payload["status"] || "active",
    notes: toCleanStringOrNull(payload["notes"]),
    created_by: payload["createdBy"],
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory_batches").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.inventory_batches.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// 8. Inventory Adjustments Handler (Append-only)
SyncManager.registerHandler("inventory_adjustments", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    transaction_id: payload["transactionId"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    reason: payload["reason"],
    notes: toCleanStringOrNull(payload["notes"]),
    quantity_before: payload["quantityBefore"] ?? 0,
    quantity_after: payload["quantityAfter"] ?? 0,
    performed_by: payload["performedBy"],
    performed_by_name: toCleanStringOrNull(payload["performedByName"]),
    timestamp: new Date(Number(payload["timestamp"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory_adjustments").insert(remoteRecord);
  if (!error || error.code === "23505") {
    await db.inventory_adjustments.update(payload["id"] as string, { sync_status: "synced" });
    return { success: true };
  }
  return { success: false, error: error?.message };
});

// 9. Inventory Alerts Handler
SyncManager.registerHandler("inventory_alerts", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    type: payload["type"],
    severity: payload["severity"],
    product_id: payload["productId"],
    branch_id: payload["branchId"],
    batch_id: toCleanStringOrNull(payload["batchId"]),
    message: payload["message"],
    expiry_date: toCleanStringOrNull(payload["expiryDate"]),
    days_remaining: payload["daysRemaining"] ?? null,
    quantity_affected: payload["quantityAffected"] ?? 0,
    acknowledged: payload["acknowledged"] ?? false,
    acknowledged_by: toCleanStringOrNull(payload["acknowledgedBy"]),
    acknowledged_at: payload["acknowledgedAt"] ? new Date(Number(payload["acknowledgedAt"])).toISOString() : null,
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("inventory_alerts").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.inventory_alerts.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// 10. Stock Count Sessions Handler
SyncManager.registerHandler("stock_count_sessions", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    session_number: payload["sessionNumber"],
    branch_id: payload["branchId"],
    status: payload["status"],
    scope: payload["scope"] || "full",
    snapshot_at: new Date(Number(payload["snapshotAt"] || Date.now())).toISOString(),
    started_at: new Date(Number(payload["startedAt"] || Date.now())).toISOString(),
    completed_at: payload["completedAt"] ? new Date(Number(payload["completedAt"])).toISOString() : null,
    approved_at: payload["approvedAt"] ? new Date(Number(payload["approvedAt"])).toISOString() : null,
    approved_by: toCleanStringOrNull(payload["approvedBy"]),
    approved_by_name: toCleanStringOrNull(payload["approvedByName"]),
    cancelled_at: payload["cancelledAt"] ? new Date(Number(payload["cancelledAt"])).toISOString() : null,
    cancelled_by: toCleanStringOrNull(payload["cancelledBy"]),
    notes: toCleanStringOrNull(payload["notes"]),
    total_variance_value: payload["totalVarianceValue"] ?? 0,
    created_by: payload["createdBy"],
    created_by_name: toCleanStringOrNull(payload["createdByName"]),
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("stock_count_sessions").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.stock_count_sessions.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});

// 11. Stock Count Items Handler
SyncManager.registerHandler("stock_count_items", async (operationType, payload) => {
  const remoteRecord = {
    id: payload["id"],
    session_id: payload["sessionId"],
    product_id: payload["productId"],
    product_code: payload["productCode"],
    product_name: payload["productName"],
    base_unit: payload["baseUnit"],
    batch_id: toCleanStringOrNull(payload["batchId"]),
    batch_number: toCleanStringOrNull(payload["batchNumber"]),
    expiry_date: toCleanStringOrNull(payload["expiryDate"]),
    system_quantity: payload["systemQuantity"] ?? 0,
    counted_quantity: payload["countedQuantity"] ?? null,
    variance: payload["variance"] ?? null,
    unit_cost: payload["unitCost"] ?? 0,
    variance_value: payload["varianceValue"] ?? null,
    notes: toCleanStringOrNull(payload["notes"]),
    counted_by: toCleanStringOrNull(payload["countedBy"]),
    counted_at: payload["countedAt"] ? new Date(Number(payload["countedAt"])).toISOString() : null,
  };

  const { error } = await client.from("stock_count_items").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.stock_count_items.update(payload["id"] as string, { sync_status: "synced" });
  }
  return { success: !error, error: error?.message };
});
