import "./user-profile-sync";
import "./entity-sync-handlers";

import { SyncManager } from "./sync-manager";
import { SyncQueueService } from "./sync-queue";
import { db } from "@/database/schema";
import { supabase } from "@/integrations/supabase/client";

const client = supabase as any;

export class SyncScheduler {
  private static timer: ReturnType<typeof setInterval> | null = null;
  private static intervalMs = 30000; // 30s auto-sync interval when online

  static start(intervalMs = this.intervalMs): void {
    this.stop();
    this.intervalMs = intervalMs;

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
    }

    // Run initial sync cycle on boot
    void this.triggerSync();

    this.timer = setInterval(() => {
      void this.triggerSync();
    }, this.intervalMs);
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
    }
  }

  private static handleOnline = () => {
    void this.triggerSync();
  };

  /**
   * Catch up existing local IndexedDB records that were created before table migration.
   * Compares local Dexie records with Supabase remote tables and enqueues missing records.
   */
  static async catchUpExistingLocalData(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      // 0. Ensure default organization exists in Supabase first to satisfy foreign key constraints
      const { data: remoteOrgs } = await client.from("organizations").select("id");
      const remoteOrgIds = new Set((remoteOrgs || []).map((o: any) => o.id));
      let localOrgs = await db.organizations.toArray();

      if (localOrgs.length === 0) {
        const defaultOrg = {
          id: "default-org-001",
          name: "Just Sly Enterprise",
          code: "ORG-001",
          tax_id: "TIN-98472910-NG",
          currency: "NGN",
          is_multi_branch_enabled: true,
          updated_at: Date.now(),
          sync_status: "synced" as const,
        };
        await db.organizations.put(defaultOrg as any);
        localOrgs = [defaultOrg as any];
      }

      for (const org of localOrgs) {
        if (!remoteOrgIds.has(org.id)) {
          await client.from("organizations").upsert(
            {
              id: org.id,
              name: org.name || "Just Sly Enterprise",
              code: org.code || "ORG-001",
              tax_id: org.tax_id || null,
              currency: org.currency || "NGN",
              is_multi_branch_enabled: true,
              updated_at: new Date(Number(org.updated_at || Date.now())).toISOString(),
            },
            { onConflict: "id" }
          );
        }
      }

      const pendingItems = await SyncQueueService.getPendingItems();
      const queuedIds = new Set(pendingItems.map((item) => item.payload["id"] as string));

      // 1. Catch up branches — direct upsert (not queued) so they exist before staff FK check
      const { data: remoteBranches, error: bErr } = await client.from("branches").select("id");
      if (!bErr) {
        const remoteBranchIds = new Set((remoteBranches || []).map((b: any) => b.id));
        const localBranches = await db.branches.toArray();
        for (const branch of localBranches) {
          if (!remoteBranchIds.has(branch.id)) {
            const { error: upsertErr } = await client.from("branches").upsert(
              {
                id: branch.id,
                code: branch.code,
                name: branch.name,
                organization_id: branch.organizationId || "default-org-001",
                email: branch.email || null,
                phone: branch.phone || null,
                address: branch.address || null,
                city: branch.city || null,
                state: branch.state || null,
                country: branch.country || "Nigeria",
                timezone: branch.timezone || "Africa/Lagos",
                currency: branch.currency || "NGN",
                receipt_prefix: branch.receiptPrefix || null,
                low_stock_threshold: branch.lowStockThreshold ?? 10,
                status: branch.status || "active",
                manager_id: branch.managerId || null,
                opening_date: branch.openingDate || null,
                notes: branch.notes || null,
                updated_at: new Date(Number(branch.updatedAt || Date.now())).toISOString(),
              },
              { onConflict: "id" }
            );
            if (!upsertErr) {
              await db.branches.update(branch.id, { sync_status: "synced" });
            } else {
              console.warn("[SyncScheduler] Branch direct upsert error:", upsertErr.message);
            }
          } else if (!queuedIds.has(branch.id) && branch.sync_status === "pending") {
            // Already exists remotely but has pending local changes — enqueue update
            await SyncQueueService.enqueue("branches", "UPSERT", branch as unknown as Record<string, unknown>);
          }
        }
      }

      // 2. Catch up staff — branches are guaranteed to exist in Supabase now
      const { data: remoteStaff, error: sErr } = await client.from("staff").select("id");
      if (!sErr) {
        const remoteStaffIds = new Set((remoteStaff || []).map((s: any) => s.id));
        const localStaff = await db.staff.toArray();
        for (const member of localStaff) {
          if (!queuedIds.has(member.id) && !remoteStaffIds.has(member.id)) {
            await SyncQueueService.enqueue("staff", "UPSERT", member as unknown as Record<string, unknown>);
          }
        }
      }

      // 3. Catch up pending product packaging
      const localPkgs = await db.product_packaging.toArray();
      for (const pkg of localPkgs) {
        if (!queuedIds.has(pkg.id) && pkg.sync_status === "pending") {
          await SyncQueueService.enqueue("product_packaging", "UPSERT", pkg as unknown as Record<string, unknown>);
        }
      }

      // 4. Catch up normalized customer, POS, and wholesale records.
      // These tables were previously written only to IndexedDB or queued under
      // entity names with no registered handler.
      const enqueueUnsent = async (
        entityType: string,
        table: { toArray: () => Promise<Array<Record<string, unknown>>> },
        remoteTable: string,
      ) => {
        const { data, error } = await client.from(remoteTable).select("id");
        if (error) return;
        const remoteIds = new Set((data || []).map((row: { id: string }) => row.id));
        for (const record of await table.toArray()) {
          const id = record["id"] as string;
          if (queuedIds.has(id)) continue;
          if (record["sync_status"] === "pending" || !remoteIds.has(id)) {
            const dependency = (record["saleId"] || record["orderId"]) as string | undefined;
            await SyncQueueService.enqueue(entityType, "UPSERT", record, {
              dependency,
              branchId: (record["branchId"] || record["hqBranchId"]) as string | undefined,
            });
          }
        }
      };

      await enqueueUnsent("customer_accounts", db.customer_accounts, "customer_accounts");
      await enqueueUnsent("sales", db.sales, "sales_normalized");
      await enqueueUnsent("sale_items", db.sale_items, "sale_items");
      await enqueueUnsent("sale_payments", db.sale_payments, "sale_payments");
      await enqueueUnsent("sale_voids", db.sale_voids, "sale_voids");
      await enqueueUnsent("wholesale_orders", db.wholesale_orders, "wholesale_orders");
      await enqueueUnsent("wholesale_order_items", db.wholesale_order_items, "wholesale_order_items");
      await enqueueUnsent("order_status_history", db.order_status_history, "order_status_history");
      await enqueueUnsent("order_payments", db.order_payments, "order_payments");
      await enqueueUnsent("payment_receipts", db.payment_receipts, "payment_receipts");
      await enqueueUnsent("invoices", db.invoices, "invoices");
    } catch (err) {
      console.warn("[SyncScheduler] Error during local data catch-up:", err);
    }
  }

  /**
   * Pulls remote changes from Supabase down into local IndexedDB storage.
   * Purges deleted users/staff and branches from local storage if missing in Supabase.
   */
  static async pullSync(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      // 1. Pull branches
      const { data: remoteBranches, error: bErr } = await client.from("branches").select("*");
      if (!bErr && remoteBranches) {
        const remoteBranchIds = new Set(remoteBranches.map((b: any) => b.id));

        // Remove local branches that were deleted in Supabase
        const localBranches = await db.branches.toArray();
        for (const lb of localBranches) {
          if (lb.sync_status === "synced" && !remoteBranchIds.has(lb.id)) {
            await db.branches.delete(lb.id);
          }
        }

        // Put remote branches into local DB
        for (const rb of remoteBranches) {
          const mapped = {
            id: rb.id,
            code: rb.code,
            name: rb.name,
            organizationId: rb.organization_id || "default-org-001",
            email: rb.email || "",
            phone: rb.phone || "",
            address: rb.address || "",
            city: rb.city || "",
            state: rb.state || "",
            country: rb.country || "Nigeria",
            timezone: rb.timezone || "Africa/Lagos",
            currency: rb.currency || "NGN",
            receiptPrefix: rb.receipt_prefix || "",
            lowStockThreshold: rb.low_stock_threshold ?? 10,
            status: rb.status || "active",
            managerId: rb.manager_id || "",
            openingDate: rb.opening_date || "",
            notes: rb.notes || "",
            createdAt: rb.created_at ? new Date(rb.created_at).getTime() : Date.now(),
            updatedAt: rb.updated_at ? new Date(rb.updated_at).getTime() : Date.now(),
            syncVersion: 1,
            sync_status: "synced" as const,
          };
          await db.branches.put(mapped);
        }
      }

      // 2. Pull profiles & staff to synchronize user deletions from Supabase Dashboard
      const [{ data: remoteProfiles }, { data: remoteStaff, error: sErr }] = await Promise.all([
        client.from("profiles").select("id"),
        client.from("staff").select("*"),
      ]);

      const validAuthUserIds = new Set((remoteProfiles || []).map((p: any) => p.id));
      const validStaffIds = new Set((remoteStaff || []).map((s: any) => s.id));

      const localStaff = await db.staff.toArray();
      for (const localMember of localStaff) {
        // If user was deleted from Supabase Auth/Profiles OR deleted from public.staff
        const isAuthDeleted = localMember.authUserId && !validAuthUserIds.has(localMember.authUserId);
        const isStaffDeleted = localMember.sync_status === "synced" && !validStaffIds.has(localMember.id) && Array.isArray(remoteStaff);

        if (isAuthDeleted || isStaffDeleted) {
          await db.staff.delete(localMember.id);
        }
      }

      // Upsert remote staff into local DB
      if (!sErr && remoteStaff) {
        for (const rs of remoteStaff) {
          const mapped = {
            id: rs.id,
            authUserId: rs.auth_user_id || undefined,
            employeeCode: rs.employee_code,
            firstName: rs.first_name,
            lastName: rs.last_name,
            email: rs.email,
            phone: rs.phone || undefined,
            role: rs.role || "staff",
            roleId: rs.role || "role-viewer",
            branchId: rs.branch_id || "branch-hq-lagos",
            status: (rs.status as any) || "active",
            hireDate: rs.hire_date || new Date().toISOString().split("T")[0],
            createdAt: rs.created_at ? new Date(rs.created_at).getTime() : Date.now(),
            updatedAt: rs.updated_at ? new Date(rs.updated_at).getTime() : Date.now(),
            syncVersion: 1,
            sync_status: "synced" as const,
          };
          await db.staff.put(mapped);
        }
      }

      // 3. Pull categories
      const { data: remoteCategories, error: catErr } = await client.from("categories").select("*");
      if (!catErr && remoteCategories) {
        for (const rc of remoteCategories) {
          await db.categories.put({
            id: rc.id,
            code: rc.code,
            name: rc.name,
            parentId: rc.parent_id || null,
            description: rc.description || undefined,
            status: rc.status || "active",
            createdAt: rc.created_at ? new Date(rc.created_at).getTime() : Date.now(),
            updatedAt: rc.updated_at ? new Date(rc.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 4. Pull products
      const { data: remoteProducts, error: prodErr } = await client.from("products").select("*");
      if (!prodErr && remoteProducts) {
        for (const rp of remoteProducts) {
          const existingProduct = await db.products.get(rp.id);
          const preservedCode = existingProduct?.code || rp.code || rp.sku || rp.id;
          await db.products.put({
            id: rp.id,
            code: preservedCode,
            sku: rp.sku || existingProduct?.sku || undefined,
            barcode: rp.barcode || existingProduct?.barcode || undefined,
            name: rp.name || existingProduct?.name || "",
            description: rp.description || existingProduct?.description || undefined,
            categoryId: rp.category_id ?? existingProduct?.categoryId ?? null,
            brand: rp.brand || existingProduct?.brand || undefined,
            manufacturer: rp.manufacturer || existingProduct?.manufacturer || undefined,
            baseUnit: rp.base_unit || existingProduct?.baseUnit || "Piece",
            trackExpiry: rp.track_expiry ?? existingProduct?.trackExpiry ?? false,
            lowStockThreshold: rp.low_stock_threshold ?? existingProduct?.lowStockThreshold ?? 0,
            costPrice: Number(rp.cost_price ?? existingProduct?.costPrice ?? 0),
            retailPrice: Number(
              rp.selling_price ?? rp.retail_price ?? existingProduct?.retailPrice ?? 0
            ),
            wholesalePrice: Number(
              rp.wholesale_price ?? existingProduct?.wholesalePrice ?? 0
            ),
            supplyPrice: Number(rp.supply_price ?? existingProduct?.supplyPrice ?? 0),
            status: rp.status || existingProduct?.status || "active",
            createdAt: rp.created_at ? new Date(rp.created_at).getTime() : existingProduct?.createdAt ?? Date.now(),
            updatedAt: rp.updated_at ? new Date(rp.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 5. Pull product packaging
      const { data: remotePackaging, error: pkgErr } = await client.from("product_packaging").select("*");
      if (!pkgErr && remotePackaging) {
        for (const rpkg of remotePackaging) {
          await db.product_packaging.put({
            id: rpkg.id,
            productId: rpkg.product_id,
            label: rpkg.label,
            unitsPerPackage: Number(rpkg.units_per_package),
            sortOrder: Number(rpkg.sort_order ?? 0),
            createdAt: rpkg.created_at ? new Date(rpkg.created_at).getTime() : Date.now(),
            updatedAt: rpkg.updated_at ? new Date(rpkg.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 5. Pull normalized customer, POS, and wholesale records.
      const putRemote = async (
        table: { get: (id: string) => Promise<Record<string, unknown> | undefined>; put: (record: Record<string, unknown>) => Promise<unknown> },
        record: Record<string, unknown>,
      ) => {
        const existing = await table.get(record.id as string);
        if (existing?.sync_status === "pending" || existing?.sync_status === "error") return;
        await table.put({ ...record, sync_status: "synced" });
      };
      const milliseconds = (value: unknown) => value ? new Date(String(value)).getTime() : Date.now();

      const { data: remoteCustomers, error: customerErr } = await client
        .from("customer_accounts")
        .select("*");
      if (!customerErr && remoteCustomers) {
        for (const row of remoteCustomers) {
          await putRemote(db.customer_accounts, {
            id: row.id,
            authUserId: row.auth_user_id || undefined,
            customerCode: row.customer_code,
            businessName: row.business_name || undefined,
            contactName: row.contact_name,
            email: row.email,
            phone: row.phone || undefined,
            address: row.address || undefined,
            city: row.city || undefined,
            state: row.state || undefined,
            country: row.country || undefined,
            creditLimit: row.credit_limit == null ? undefined : Number(row.credit_limit),
            status: row.status || "active",
            notes: row.notes || undefined,
            createdAt: milliseconds(row.created_at),
            updatedAt: milliseconds(row.updated_at),
          });
        }
      }

      const { data: remoteSales, error: salesErr } = await client
        .from("sales_normalized")
        .select("*");
      if (!salesErr && remoteSales) {
        for (const row of remoteSales) {
          await putRemote(db.sales, {
            id: row.id,
            branchId: row.branch_id,
            saleNumber: row.sale_number,
            status: row.status,
            paymentStatus: row.payment_status,
            subtotal: Number(row.subtotal ?? 0),
            discountAmount: Number(row.discount_amount ?? 0),
            totalAmount: Number(row.total_amount ?? 0),
            amountTendered: Number(row.amount_tendered ?? 0),
            currency: row.currency || "NGN",
            paymentMethod: row.payment_method,
            createdBy: row.created_by,
            createdByName: row.created_by_name || undefined,
            completedAt: row.completed_at ? milliseconds(row.completed_at) : undefined,
            voidedAt: row.voided_at ? milliseconds(row.voided_at) : undefined,
            notes: row.notes || undefined,
            createdAt: milliseconds(row.created_at),
            updatedAt: milliseconds(row.updated_at),
          });
        }
      }

      const { data: remoteSaleItems, error: saleItemsErr } = await client
        .from("sale_items")
        .select("*");
      if (!saleItemsErr && remoteSaleItems) {
        for (const row of remoteSaleItems) {
          await putRemote(db.sale_items, {
            id: row.id,
            saleId: row.sale_id,
            productId: row.product_id,
            productName: row.product_name,
            packagingLabel: row.packaging_label || undefined,
            quantity: Number(row.quantity ?? 0),
            baseQuantity: Number(row.base_quantity ?? 0),
            unitPrice: Number(row.unit_price ?? 0),
            costPrice: Number(row.cost_price ?? 0),
            subtotal: Number(row.subtotal ?? 0),
            createdAt: milliseconds(row.created_at),
          });
        }
      }

      const { data: remoteSalePayments, error: salePaymentsErr } = await client
        .from("sale_payments")
        .select("*");
      if (!salePaymentsErr && remoteSalePayments) {
        for (const row of remoteSalePayments) {
          await putRemote(db.sale_payments, {
            id: row.id,
            saleId: row.sale_id,
            method: row.method,
            status: row.status,
            amount: Number(row.amount ?? 0),
            reference: row.reference || undefined,
            createdAt: milliseconds(row.created_at),
          });
        }
      }

      const { data: remoteSaleVoids, error: saleVoidsErr } = await client
        .from("sale_voids")
        .select("*");
      if (!saleVoidsErr && remoteSaleVoids) {
        for (const row of remoteSaleVoids) {
          await putRemote(db.sale_voids, {
            id: row.id,
            saleId: row.sale_id,
            reason: row.reason,
            voidedBy: row.voided_by,
            createdAt: milliseconds(row.created_at),
            inventoryReversed: row.inventory_reversed ?? false,
          });
        }
      }

      const { data: remoteOrders, error: wholesaleErr } = await client
        .from("wholesale_orders")
        .select("*");
      if (!wholesaleErr && remoteOrders) {
        for (const row of remoteOrders) {
          await putRemote(db.wholesale_orders, {
            id: row.id,
            orderNumber: row.order_number,
            customerId: row.customer_id,
            hqBranchId: row.hq_branch_id,
            status: row.status,
            paymentStatus: row.payment_status,
            subtotal: Number(row.subtotal ?? 0),
            discountAmount: Number(row.discount_amount ?? 0),
            totalAmount: Number(row.total_amount ?? 0),
            currency: row.currency || "NGN",
            notes: row.notes || undefined,
            createdAt: milliseconds(row.created_at),
            updatedAt: milliseconds(row.updated_at),
          });
        }
      }

      const { data: remoteOrderItems, error: orderItemsErr } = await client
        .from("wholesale_order_items")
        .select("*");
      if (!orderItemsErr && remoteOrderItems) {
        for (const row of remoteOrderItems) {
          await putRemote(db.wholesale_order_items, {
            id: row.id,
            orderId: row.order_id,
            productId: row.product_id,
            productName: row.product_name,
            productCode: row.sku,
            sku: row.sku,
            sellingUnit: row.selling_unit,
            unitsPerPackage: Number(row.units_per_package ?? 1),
            quantity: Number(row.quantity ?? 0),
            baseQuantity: Number(row.base_quantity ?? 0),
            unitPriceSnapshot: Number(row.unit_price_snapshot ?? 0),
            costPriceSnapshot: Number(row.cost_price_snapshot ?? 0),
            subtotal: Number(row.subtotal ?? 0),
            createdAt: milliseconds(row.created_at),
          });
        }
      }

      const { data: remoteHistory, error: historyErr } = await client
        .from("order_status_history")
        .select("*");
      if (!historyErr && remoteHistory) {
        for (const row of remoteHistory) {
          await putRemote(db.order_status_history, {
            id: row.id,
            orderId: row.order_id,
            fromStatus: row.from_status || undefined,
            toStatus: row.to_status,
            changedBy: row.changed_by,
            reason: row.reason || undefined,
            timestamp: milliseconds(row.timestamp),
          });
        }
      }

      const { data: remoteOrderPayments, error: orderPaymentsErr } = await client
        .from("order_payments")
        .select("*");
      if (!orderPaymentsErr && remoteOrderPayments) {
        for (const row of remoteOrderPayments) {
          await putRemote(db.order_payments, {
            id: row.id,
            orderId: row.order_id,
            paymentMethod: row.payment_method || "bank_transfer",
            amount: Number(row.amount ?? 0),
            status: row.status,
            reference: row.reference || undefined,
            createdAt: milliseconds(row.created_at),
          });
        }
      }

      const { data: remoteReceipts, error: receiptsErr } = await client
        .from("payment_receipts")
        .select("*");
      if (!receiptsErr && remoteReceipts) {
        for (const row of remoteReceipts) {
          await putRemote(db.payment_receipts, {
            id: row.id,
            orderId: row.order_id,
            paymentId: row.payment_id,
            filePath: row.storage_path,
            fileName: row.file_name,
            mimeType: row.mime_type || "application/octet-stream",
            fileSize: Number(row.file_size ?? 0),
            uploadedBy: row.uploaded_by,
            uploadedAt: milliseconds(row.uploaded_at),
            bankName: row.bank_name || undefined,
            transferReference: row.transfer_reference || undefined,
            publicUrl: row.public_url || undefined,
          });
        }
      }

      const { data: remoteInvoices, error: invoicesErr } = await client
        .from("invoices")
        .select("*");
      if (!invoicesErr && remoteInvoices) {
        for (const row of remoteInvoices) {
          await putRemote(db.invoices, {
            id: row.id,
            orderId: row.order_id,
            invoiceNumber: row.invoice_number,
            customerId: row.customer_id,
            amountDue: Number(row.amount ?? row.amount_due ?? 0),
            dueDate: row.due_date ? milliseconds(row.due_date) : undefined,
            status: row.status || "unpaid",
            createdAt: milliseconds(row.created_at || row.issued_at),
            updatedAt: milliseconds(row.updated_at || row.issued_at),
          });
        }
      }

      // 6. Pull price history (append-only — only pull records we don't have)
      const localPriceHistoryIds = new Set(
        (await db.price_history.toArray()).map((h) => h.id)
      );
      const { data: remotePriceHistory, error: phErr } = await client
        .from("price_history")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);
      if (!phErr && remotePriceHistory) {
        for (const rph of remotePriceHistory) {
          if (!localPriceHistoryIds.has(rph.id)) {
            await db.price_history.put({
              id: rph.id,
              productId: rph.product_id,
              priceType: rph.price_type,
              previousPrice: Number(rph.previous_price),
              newPrice: Number(rph.new_price),
              changedBy: rph.changed_by || "system",
              changedByName: rph.changed_by_name || undefined,
              reason: rph.reason || undefined,
              timestamp: rph.timestamp ? new Date(rph.timestamp).getTime() : Date.now(),
              sync_status: "synced" as const,
            });
          }
        }
      }

      // 7. Pull inventory balances
      const { data: remoteBalances, error: balErr } = await client.from("inventory_balances").select("*");
      if (!balErr && remoteBalances) {
        for (const rb of remoteBalances) {
          await db.inventory_balances.put({
            id: rb.id,
            productId: rb.product_id,
            branchId: rb.branch_id,
            quantityOnHand: Number(rb.quantity_on_hand ?? 0),
            reservedQuantity: Number(rb.reserved_quantity ?? 0),
            incomingQuantity: Number(rb.incoming_quantity ?? 0),
            valuationMethod: rb.valuation_method || "fifo",
            totalCostValue: Number(rb.total_cost_value ?? 0),
            weightedAvgCost: Number(rb.weighted_avg_cost ?? 0),
            lastTransactionId: rb.last_transaction_id || "",
            updatedAt: rb.updated_at ? new Date(rb.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 8. Pull inventory batches
      const { data: remoteBatches, error: batErr } = await client.from("inventory_batches").select("*");
      if (!batErr && remoteBatches) {
        for (const rbat of remoteBatches) {
          await db.inventory_batches.put({
            id: rbat.id,
            batchNumber: rbat.batch_number,
            productId: rbat.product_id,
            branchId: rbat.branch_id,
            quantityOnHand: Number(rbat.quantity_on_hand ?? 0),
            initialQuantity: Number(rbat.initial_quantity ?? 0),
            manufactureDate: rbat.manufacture_date || undefined,
            expiryDate: rbat.expiry_date || undefined,
            unitCost: Number(rbat.unit_cost ?? 0),
            supplierId: rbat.supplier_id || null,
            status: rbat.status || "active",
            notes: rbat.notes || undefined,
            createdBy: rbat.created_by,
            createdAt: rbat.created_at ? new Date(rbat.created_at).getTime() : Date.now(),
            updatedAt: rbat.updated_at ? new Date(rbat.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 9. Pull active inventory alerts
      const { data: remoteAlerts, error: altErr } = await client.from("inventory_alerts").select("*").eq("acknowledged", false);
      if (!altErr && remoteAlerts) {
        for (const ralt of remoteAlerts) {
          await db.inventory_alerts.put({
            id: ralt.id,
            type: ralt.type,
            severity: ralt.severity,
            productId: ralt.product_id,
            branchId: ralt.branch_id,
            batchId: ralt.batch_id || null,
            message: ralt.message,
            expiryDate: ralt.expiry_date || null,
            daysRemaining: ralt.days_remaining ?? null,
            quantityAffected: Number(ralt.quantity_affected ?? 0),
            acknowledged: ralt.acknowledged ?? false,
            acknowledgedBy: ralt.acknowledged_by || null,
            acknowledgedAt: ralt.acknowledged_at ? new Date(ralt.acknowledged_at).getTime() : null,
            createdAt: ralt.created_at ? new Date(ralt.created_at).getTime() : Date.now(),
            updatedAt: ralt.updated_at ? new Date(ralt.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      // 10. Pull user_permission_overrides
      const { data: remoteOverrides, error: ovErr } = await client.from("user_permission_overrides").select("*");
      if (!ovErr && remoteOverrides) {
        for (const rov of remoteOverrides) {
          await db.user_permission_overrides.put({
            id: rov.id,
            organizationId: rov.organization_id || "org-default",
            userId: rov.user_id,
            permissionId: rov.permission_id,
            effect: rov.effect,
            reason: rov.reason || null,
            createdBy: rov.created_by || "system",
            createdAt: rov.created_at ? new Date(rov.created_at).getTime() : Date.now(),
            updatedAt: rov.updated_at ? new Date(rov.updated_at).getTime() : Date.now(),
            sync_status: "synced" as const,
          });
        }
      }

      SyncManager.emit("sync:pull:complete", { timestamp: Date.now() });
    } catch (err) {
      console.warn("[SyncScheduler] Error during pull sync:", err);
    }
  }

  static async triggerSync(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    await this.catchUpExistingLocalData();
    await SyncQueueService.requeueFailedForEntity(
      "user_permission_overrides",
      "No sync handler registered",
    );
    await SyncManager.processQueue();
    await this.pullSync();
  }

  /**
   * One-time recovery for records created before all sync handlers existed.
   * Call this from an authenticated admin recovery action after deploying the
   * matching Supabase migration.
   */
  static async recoverLocalData(): Promise<{
    requeuedFailed: number;
    syncResult: Awaited<ReturnType<typeof SyncManager.processQueue>>;
  }> {
    const requeuedFailed = await SyncQueueService.requeueFailed();
    await this.catchUpExistingLocalData();
    const syncResult = await SyncManager.processQueue();
    await this.pullSync();
    return { requeuedFailed, syncResult };
  }
}
