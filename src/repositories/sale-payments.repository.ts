import { db } from "@/database/schema";
import type { SalePaymentSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class SalePaymentsRepository extends BaseRepository<SalePaymentSchema> {
  constructor() {
    super("sale_payments", db.sale_payments);
  }

  /** All payments for a specific sale */
  async getBySaleId(saleId: string): Promise<SalePaymentSchema[]> {
    return db.sale_payments.where("saleId").equals(saleId).toArray();
  }

  /** Payments by method */
  async getByMethod(method: "cash" | "bank_transfer" | "card"): Promise<SalePaymentSchema[]> {
    return db.sale_payments.where("method").equals(method).toArray();
  }
}

export const salePaymentsRepository = new SalePaymentsRepository();
