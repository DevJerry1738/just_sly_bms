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
    role: payload["role"] || "staff",
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
    sku: payload["sku"],
    name: payload["name"],
    description: toCleanStringOrNull(payload["description"]),
    category_id: toCleanStringOrNull(payload["categoryId"]),
    category_name: toCleanStringOrNull(payload["categoryName"]),
    unit: payload["unit"] || "pcs",
    cost_price: payload["costPrice"] ?? 0,
    selling_price: payload["sellingPrice"] ?? 0,
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

// 4. Inventory Handler
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

// 5. Sales Handler
SyncManager.registerHandler("sales", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("sales").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    receipt_number: payload["receiptNumber"],
    branch_id: payload["branchId"],
    cashier_id: toCleanUuidOrNull(payload["cashierId"]),
    customer_id: toCleanStringOrNull(payload["customerId"]),
    items: payload["items"] || [],
    subtotal: payload["subtotal"] ?? 0,
    tax: payload["tax"] ?? 0,
    discount: payload["discount"] ?? 0,
    total: payload["total"] ?? 0,
    payment_method: payload["paymentMethod"] || "cash",
    payment_status: payload["paymentStatus"] || "paid",
    status: payload["status"] || "completed",
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("sales").upsert(remoteRecord, { onConflict: "id" });
  return { success: !error, error: error?.message };
});

// 6. Orders Handler
SyncManager.registerHandler("orders", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("orders").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    order_number: payload["orderNumber"],
    branch_id: payload["branchId"],
    customer_id: toCleanStringOrNull(payload["customerId"]),
    items: payload["items"] || [],
    total_amount: payload["totalAmount"] ?? 0,
    status: payload["status"] || "pending",
    notes: toCleanStringOrNull(payload["notes"]),
    order_date: payload["orderDate"] ? new Date(Number(payload["orderDate"])).toISOString() : new Date().toISOString(),
    expected_delivery_date: payload["expectedDeliveryDate"] ? new Date(Number(payload["expectedDeliveryDate"])).toISOString() : null,
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("orders").upsert(remoteRecord, { onConflict: "id" });
  return { success: !error, error: error?.message };
});

// 7. Customers Handler
SyncManager.registerHandler("customers", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("customers").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    name: payload["name"],
    company_name: toCleanStringOrNull(payload["companyName"]),
    email: toCleanStringOrNull(payload["email"]),
    phone: toCleanStringOrNull(payload["phone"]),
    address: toCleanStringOrNull(payload["address"]),
    type: payload["type"] || "retail",
    credit_limit: payload["creditLimit"] ?? 0,
    outstanding_balance: payload["outstandingBalance"] ?? 0,
    status: payload["status"] || "active",
    updated_at: new Date(Number(payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("customers").upsert(remoteRecord, { onConflict: "id" });
  return { success: !error, error: error?.message };
});

// 8. Organizations Handler
SyncManager.registerHandler("organizations", async (operationType, payload) => {
  if (operationType === "DELETE") {
    const id = payload["id"] as string;
    const { error } = await client.from("organizations").delete().eq("id", id);
    return { success: !error, error: error?.message };
  }

  const remoteRecord = {
    id: payload["id"],
    name: payload["name"],
    code: toCleanStringOrNull(payload["code"]),
    tax_id: toCleanStringOrNull(payload["taxId"]),
    currency: payload["currency"] || "NGN",
    is_multi_branch_enabled: payload["isMultiBranchEnabled"] ?? true,
    updated_at: new Date(Number(payload["updated_at"] || payload["updatedAt"] || Date.now())).toISOString(),
  };

  const { error } = await client.from("organizations").upsert(remoteRecord, { onConflict: "id" });
  return { success: !error, error: error?.message };
});
