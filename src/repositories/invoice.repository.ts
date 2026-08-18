import { db } from "@/database/schema";
import type { InvoiceSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class InvoiceRepository extends BaseRepository<InvoiceSchema> {
  constructor() {
    super("invoices", db.invoices);
  }

  /** Find invoice by order ID */
  async getByOrderId(orderId: string): Promise<InvoiceSchema | undefined> {
    return db.invoices.where("orderId").equals(orderId).first();
  }

  /** Find invoices for a customer */
  async getByCustomerId(customerId: string): Promise<InvoiceSchema[]> {
    const invoices = await db.invoices.where("customerId").equals(customerId).toArray();
    return invoices.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Generate unique invoice number e.g. INV-000124 */
  async generateInvoiceNumber(): Promise<string> {
    const all = await this.getAll();
    const count = all.length + 10001;
    return `INV-${String(count).slice(1)}`;
  }
}

export const invoiceRepository = new InvoiceRepository();
