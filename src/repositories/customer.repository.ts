import { db } from "@/database/schema";
import type { CustomerAccountSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";
import { supabase } from "@/integrations/supabase/client";
import { DomainEvents } from "@/services/events/domain-events";

export class CustomerRepository extends BaseRepository<CustomerAccountSchema> {
  constructor() {
    super("customer_accounts", db.customer_accounts);
  }

  /** Find customer by auth user ID */
  async getByAuthUserId(authUserId: string): Promise<CustomerAccountSchema | undefined> {
    return db.customer_accounts.where("authUserId").equals(authUserId).first();
  }

  /** Find customer by email with local Dexie & fallback provisioning */
  async getByEmail(email: string): Promise<CustomerAccountSchema | undefined> {
    if (!email) return undefined;
    const lower = email.toLowerCase();
    const local = await db.customer_accounts.where("email").equals(lower).first();
    if (local) return local;

    const all = await this.getAll();
    const match = all.find((c) => c.email?.toLowerCase() === lower);
    if (match) return match;

    // Fallback: If not found in IndexedDB (e.g. customer logged in from a fresh browser context),
    // check if current authenticated Supabase user matches this email.
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData.session?.user && authData.session.user.email?.toLowerCase() === lower) {
        const user = authData.session.user;
        const code = await this.generateCustomerCode();
        const newCust: CustomerAccountSchema = {
          id: user.id,
          authUserId: user.id,
          customerCode: code,
          businessName: (user.user_metadata?.full_name as string) || "Wholesale Customer",
          contactName: (user.user_metadata?.full_name as string) || "Wholesale Customer",
          email: lower,
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sync_status: "synced",
        };
        await db.customer_accounts.put(newCust);
        return newCust;
      }
    } catch {
      // Ignore auth check error
    }

    return undefined;
  }

  /** Generate unique customer code e.g. CUST-0001 */
  async generateCustomerCode(): Promise<string> {
    const all = await this.getAll();
    const count = all.length + 1;
    return `CUST-${String(count).padStart(4, "0")}`;
  }

  async createCustomer(data: CustomerAccountSchema): Promise<CustomerAccountSchema> {
    const saved = await this.create(data);
    await DomainEvents.publish("CUSTOMER_CREATED", {
      entity: "Customer",
      entityId: saved.id,
      record: saved,
      description: `Created customer ${saved.customerCode} (${saved.businessName || saved.contactName})`,
    });
    return saved;
  }

  async updateCustomer(id: string, updates: Partial<CustomerAccountSchema>): Promise<CustomerAccountSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, updates);
    await DomainEvents.publish("CUSTOMER_UPDATED", {
      entity: "Customer",
      entityId: id,
      before,
      after: updated,
      description: `Updated customer ${updated.customerCode || id}`,
    });
    return updated;
  }
}

export const customerRepository = new CustomerRepository();
