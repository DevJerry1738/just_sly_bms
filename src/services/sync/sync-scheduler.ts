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
    } catch (err) {
      console.warn("[SyncScheduler] Error during pull sync:", err);
    }
  }

  static async triggerSync(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    await this.catchUpExistingLocalData();
    await SyncManager.processQueue();
    await this.pullSync();
  }
}
