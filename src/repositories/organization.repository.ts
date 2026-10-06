import { BaseRepository } from "./base.repository";
import { db, type OrganizationSchema } from "@/database/schema";

export const DEFAULT_ORGANIZATION_ID = "default-org-001";

export class OrganizationRepository extends BaseRepository<OrganizationSchema> {
  constructor() {
    super("organizations", db.organizations);
  }

  /** Fetch the primary organization profile, creating only the required local record. */
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

    const organization: OrganizationSchema = {
      id: DEFAULT_ORGANIZATION_ID,
      name: "Just Sly Enterprise",
      currency: "NGN",
      timezone: "Africa/Lagos",
      updated_at: Date.now(),
      sync_status: "pending",
    };

    await this.table.put(organization);
    return organization;
  }

  /** Ensure the primary organization has a queued remote mutation. */
  async ensurePrimaryOrganizationSync(): Promise<OrganizationSchema> {
    const organization = await this.getPrimaryOrganization();
    const organizationQueueItem = await db.syncQueue
      .where("entityType")
      .equals("organizations")
      .and((item) => item.payload["id"] === organization.id)
      .first();

    if (!organizationQueueItem) {
      await this.enqueueMutation("UPSERT", organization as unknown as Record<string, unknown>);
    } else if (organizationQueueItem.status === "failed") {
      await db.syncQueue.update(organizationQueueItem.id, {
        status: "pending",
        errorMessage: undefined,
      });
    }

    return organization;
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
