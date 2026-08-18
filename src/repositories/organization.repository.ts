import { BaseRepository } from "./base.repository";
import { db, type OrganizationSchema } from "@/database/schema";

export const DEFAULT_ORGANIZATION_ID = "default-org-001";

export class OrganizationRepository extends BaseRepository<OrganizationSchema> {
  constructor() {
    super("organizations", db.organizations);
  }

  /**
   * Fetch the primary active organization profile or initialize default schema.
   */
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

    const defaultOrg: OrganizationSchema = {
      id: DEFAULT_ORGANIZATION_ID,
      name: "Just Sly Enterprise",
      legal_name: "Just Sly Business Solutions Nigeria Ltd",
      tax_id: "TIN-98472910-NG",
      registration_number: "CS-92840192",
      email: "billing@justsly.com",
      phone: "+234 1 700 0000",
      address: "123 Business Avenue, Suite 400",
      city: "Lagos",
      country: "Nigeria",
      currency: "NGN",
      timezone: "WAT",
      date_format: "DD/MM/YYYY",
      logo_url: "",
      primary_color: "#0f172a",
      receipt_header: "Thank you for shopping with Just Sly!",
      receipt_footer: "Goods sold in good condition are not returnable.",
      receipt_tax_note: "All prices are inclusive of 15% VAT & Levies.",
      show_receipt_logo: true,
      bank_name: "Access Bank Plc",
      bank_account_number: "0123456789",
      bank_account_name: "Just Sly Business Solutions Ltd",
      bank_instructions: "Please use your Order Number (e.g. WO-0001) as the transfer reference/narration.",
      updated_at: Date.now(),
      sync_status: "synced",
    };

    await db.organizations.put(defaultOrg);
    return defaultOrg;
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
