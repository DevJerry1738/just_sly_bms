import { BaseRepository } from "./base.repository";
import { db, type OrganizationSchema } from "@/database/schema";

export const DEFAULT_ORGANIZATION_ID = "default-org-001";

export class OrganizationRepository extends BaseRepository<OrganizationSchema> {
  constructor() {
    super("organizations", db.organizations);
  }

  /** Fetch the primary organization profile without creating demo business data. */
  async getPrimaryOrganization(): Promise<OrganizationSchema> {
    const orgs = await this.getAll();
    if (orgs.length > 0 && orgs[0]) {
      const org = orgs[0];
      // Backfill default bank details if not set
      if (!org.bank_name || !org.bank_account_number) {
        org.bank_name = org.bank_name || "Access Bank Plc";
        org.bank_account_number = org.bank_account_number || "0123456789";
        org.bank_account_name = org.bank_account_name || "Just Sly Business Solutions Ltd";
        org.bank_instructions = org.bank_instructions || "Please use your Order Number (e.g. WO-0001) as the transfer reference/narration.";
        await db.organizations.put(org);
      }
      return org;
    }

    return {
      id: DEFAULT_ORGANIZATION_ID,
      name: "",
      updated_at: Date.now(),
    };
  }

  /**
   * Save organization updates and enqueue mutation for remote sync.
   */
  async updatePrimaryOrganization(updates: Partial<OrganizationSchema>): Promise<OrganizationSchema> {
    const current = await this.getPrimaryOrganization();
    const updated: OrganizationSchema = {
      ...current,
      ...updates,
      updated_at: Date.now(),
      sync_status: "pending",
    };

    await this.table.put(updated);
    await this.enqueueMutation("UPSERT", updated as unknown as Record<string, unknown>);
    return updated;
  }
}

export const organizationRepository = new OrganizationRepository();
