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

// Offline-first customer accounts and normalized POS/wholesale records.
async function markLocalSynced(table: { update: (id: string, changes: Record<string, unknown>) => Promise<unknown> }, id: string) {
  await table.update(id, { sync_status: "synced" });
}

SyncManager.registerHandler("customer_accounts", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("customer_accounts").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const { error } = await client.from("customer_accounts").upsert({
    id,
    auth_user_id: toCleanUuidOrNull(payload["authUserId"]),
    customer_code: payload["customerCode"],
    business_name: toCleanStringOrNull(payload["businessName"]),
    contact_name: payload["contactName"],
    email: payload["email"],
    phone: toCleanStringOrNull(payload["phone"]),
    address: toCleanStringOrNull(payload["address"]),
    city: toCleanStringOrNull(payload["city"]),
    state: toCleanStringOrNull(payload["state"]),
    country: toCleanStringOrNull(payload["country"]),
    credit_limit: payload["creditLimit"] ?? null,
    status: payload["status"] || "active",
    notes: toCleanStringOrNull(payload["notes"]),
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.customer_accounts, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("sales", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("sales_normalized").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const timestamp = (value: unknown) => value ? new Date(Number(value)).toISOString() : null;
  const { error } = await client.from("sales_normalized").upsert({
    id,
    branch_id: payload["branchId"],
    sale_number: payload["saleNumber"],
    status: payload["status"],
    payment_status: payload["paymentStatus"],
    subtotal: payload["subtotal"] ?? 0,
    discount_amount: payload["discountAmount"] ?? 0,
    total_amount: payload["totalAmount"] ?? 0,
    amount_tendered: payload["amountTendered"] ?? 0,
    currency: payload["currency"] || "NGN",
    payment_method: payload["paymentMethod"],
    created_by: payload["createdBy"],
    created_by_name: toCleanStringOrNull(payload["createdByName"]),
    completed_at: timestamp(payload["completedAt"]),
    voided_at: timestamp(payload["voidedAt"]),
    notes: toCleanStringOrNull(payload["notes"]),
    created_at: timestamp(payload["createdAt"]) || new Date().toISOString(),
    updated_at: timestamp(payload["updatedAt"]) || new Date().toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.sales, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("sale_items", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("sale_items").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("sale_items").upsert({
    id,
    sale_id: payload["saleId"],
    product_id: payload["productId"],
    product_name: payload["productName"],
    packaging_label: toCleanStringOrNull(payload["packagingLabel"]),
    quantity: payload["quantity"] ?? 0,
    base_quantity: payload["baseQuantity"] ?? 0,
    unit_price: payload["unitPrice"] ?? 0,
    cost_price: payload["costPrice"] ?? 0,
    subtotal: payload["subtotal"] ?? 0,
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.sale_items, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("sale_payments", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("sale_payments").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("sale_payments").upsert({
    id,
    sale_id: payload["saleId"],
    method: payload["method"],
    status: payload["status"],
    amount: payload["amount"] ?? 0,
    reference: toCleanStringOrNull(payload["reference"]),
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.sale_payments, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("sale_voids", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("sale_voids").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("sale_voids").upsert({
    id,
    sale_id: payload["saleId"],
    reason: payload["reason"],
    voided_by: payload["voidedBy"],
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
    inventory_reversed: payload["inventoryReversed"] ?? false,
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.sale_voids, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("wholesale_orders", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("wholesale_orders").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const timestamp = (value: unknown) => value ? new Date(Number(value)).toISOString() : null;
  const { error } = await client.from("wholesale_orders").upsert({
    id,
    order_number: payload["orderNumber"],
    customer_id: payload["customerId"],
    hq_branch_id: payload["hqBranchId"],
    status: payload["status"],
    payment_status: payload["paymentStatus"],
    subtotal: payload["subtotal"] ?? 0,
    discount_amount: payload["discountAmount"] ?? 0,
    total_amount: payload["totalAmount"] ?? 0,
    currency: payload["currency"] || "NGN",
    notes: toCleanStringOrNull(payload["notes"]),
    created_at: timestamp(payload["createdAt"]) || new Date().toISOString(),
    updated_at: timestamp(payload["updatedAt"]) || new Date().toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.wholesale_orders, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("wholesale_order_items", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("wholesale_order_items").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("wholesale_order_items").upsert({
    id,
    order_id: payload["orderId"],
    product_id: payload["productId"],
    product_name: payload["productName"],
    sku: payload["sku"] || payload["productCode"],
    selling_unit: payload["sellingUnit"],
    units_per_package: payload["unitsPerPackage"] ?? 1,
    quantity: payload["quantity"] ?? 0,
    base_quantity: payload["baseQuantity"] ?? 0,
    unit_price_snapshot: payload["unitPriceSnapshot"] ?? 0,
    cost_price_snapshot: payload["costPriceSnapshot"] ?? 0,
    subtotal: payload["subtotal"] ?? 0,
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.wholesale_order_items, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("order_status_history", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("order_status_history").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("order_status_history").upsert({
    id,
    order_id: payload["orderId"],
    from_status: toCleanStringOrNull(payload["fromStatus"]),
    to_status: payload["toStatus"],
    changed_by: payload["changedBy"],
    reason: toCleanStringOrNull(payload["reason"]),
    timestamp: new Date(Number(payload["timestamp"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.order_status_history, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("order_payments", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("order_payments").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("order_payments").upsert({
    id,
    order_id: payload["orderId"],
    amount: payload["amount"] ?? 0,
    status: payload["status"],
    created_at: new Date(Number(payload["createdAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.order_payments, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("payment_receipts", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("payment_receipts").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("payment_receipts").upsert({
    id,
    order_id: payload["orderId"],
    file_name: payload["fileName"],
    bank_name: toCleanStringOrNull(payload["bankName"]),
    transfer_reference: toCleanStringOrNull(payload["transferReference"]),
    storage_path: payload["filePath"] || payload["storagePath"],
    uploaded_at: new Date(Number(payload["uploadedAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.payment_receipts, id);
  return { success: !error, error: error?.message };
});

SyncManager.registerHandler("invoices", async (operationType, payload) => {
  const id = payload["id"] as string;
  if (operationType === "DELETE") {
    const { error } = await client.from("invoices").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }
  const { error } = await client.from("invoices").upsert({
    id,
    order_id: payload["orderId"],
    invoice_number: payload["invoiceNumber"],
    amount: payload["amount"] ?? payload["amountDue"] ?? 0,
    issued_at: new Date(Number(payload["issuedAt"] || payload["createdAt"] || Date.now())).toISOString(),
  }, { onConflict: "id" });
  if (!error) await markLocalSynced(db.invoices, id);
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

// 12. User Permission Overrides Handler
SyncManager.registerHandler("user_permission_overrides", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("user_permission_overrides").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    organization_id: payload["organizationId"] || "org-default",
    user_id: payload["userId"],
    permission_id: payload["permissionId"],
    effect: payload["effect"],
    reason: toCleanStringOrNull(payload["reason"]),
    created_by: payload["createdBy"] || "system",
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("user_permission_overrides").upsert(remoteRecord, { onConflict: "id" });
  if (!error) {
    await db.user_permission_overrides.update(payload["id"] as string, { sync_status: "synced" });
  } else {
    console.error("[Sync] User permission overrides upsert error:", error.message);
  }
  return { success: !error, error: error?.message };
});
