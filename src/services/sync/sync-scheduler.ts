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
