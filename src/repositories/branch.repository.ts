import { BaseRepository } from "./base.repository";
import { db, type BranchSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";

export class BranchRepository extends BaseRepository<BranchSchema> {
  constructor() {
    super("branches", db.branches);
  }

  /**
   * Fetch all active branches.
   */
  async getActiveBranches(): Promise<BranchSchema[]> {
    const branches = await this.getAll();
    return branches.filter((b) => b.status === "active" && !b.deletedAt);
  }

  /**
   * Fetch the designated HQ branch.
   */
  async getHqBranch(): Promise<BranchSchema> {
    const branches = await this.ensureSeedBranches();
    const hq = branches.find((b) => b.isHq || b.code?.startsWith("HQ") || b.id === "branch-hq-lagos");
    if (hq) return hq;
    return branches[0];
  }

  /**
   * Initialize default seed branches if none exist in local storage.
   */
  async ensureSeedBranches(): Promise<BranchSchema[]> {
    const existing = await this.getAll();
    if (existing.length > 0) return existing;

    const seedBranches: BranchSchema[] = [
      {
        id: "branch-hq-lagos",
        code: "HQ-001",
        name: "Lagos Central Flagship (HQ)",
        isHq: true,
        organizationId: "default-org-001",
        email: "lagos@justsly.com",
        phone: "+234 1 700 0001",
        address: "123 Ozumba Mbadiwe Avenue",
        city: "Lagos",
        state: "Lagos State",
        country: "Nigeria",
        timezone: "Africa/Lagos",
        currency: "NGN",
        receiptPrefix: "HQ-LAG-",
        lowStockThreshold: 15,
        status: "active",
        openingDate: "2024-01-15",
        notes: "Main distribution hub and executive office.",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncVersion: 1,
        sync_status: "synced",
      },
      {
        id: "branch-kano-north",
        code: "KNO-002",
        name: "Kano North Branch",
        organizationId: "default-org-001",
        email: "kano@justsly.com",
        phone: "+234 64 300 0002",
        address: "45 Zaria Road",
        city: "Kano",
        state: "Kano State",
        country: "Nigeria",
        timezone: "Africa/Lagos",
        currency: "NGN",
        receiptPrefix: "KNO-02-",
        lowStockThreshold: 10,
        status: "active",
        openingDate: "2024-06-01",
        notes: "Retail POS and wholesale regional depot.",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncVersion: 1,
        sync_status: "synced",
      },
    ];

    for (const b of seedBranches) {
      await db.branches.put(b);
    }
    return seedBranches;
  }

  /**
   * Create new branch with auto-generated branch code if missing.
   */
  async createBranch(data: Partial<BranchSchema>): Promise<BranchSchema> {
    const count = (await this.getAll()).length;
    const code = data.code || `BR-${String(count + 1).padStart(3, "0")}`;

    const newBranch: BranchSchema = {
      id: data.id || crypto.randomUUID(),
      code,
      name: data.name || "New Branch",
      organizationId: data.organizationId || "default-org-001",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      city: data.city || "",
      state: data.state || "",
      country: data.country || "Nigeria",
      timezone: data.timezone || "Africa/Lagos",
      currency: data.currency || "NGN",
      receiptPrefix: data.receiptPrefix || `${code}-`,
      lowStockThreshold: data.lowStockThreshold ?? 10,
      status: data.status || "active",
      managerId: data.managerId || "",
      openingDate: data.openingDate || new Date().toISOString().split("T")[0],
      notes: data.notes || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncVersion: 1,
      sync_status: "pending",
    };

    const saved = await this.create(newBranch);
    await DomainEvents.publish("BRANCH_CREATED", { entity: "Branch", entityId: saved.id, record: saved });
    return saved;
  }

  /**
   * Update existing branch details.
   */
  async updateBranch(id: string, updates: Partial<BranchSchema>): Promise<BranchSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { ...updates, updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("BRANCH_UPDATED", { entity: "Branch", entityId: id, before, after: updated });
    return updated;
  }

  /**
   * Update branch operational status.
   */
  async setBranchStatus(id: string, status: "active" | "inactive" | "temporarily_closed"): Promise<BranchSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { status, updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("BRANCH_DISABLED", { entity: "Branch", entityId: id, before, status });
    return updated;
  }
}

export const branchRepository = new BranchRepository();
