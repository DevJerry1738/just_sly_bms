import { db } from "@/database/schema";
import type { SaleVoidSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class SaleVoidsRepository extends BaseRepository<SaleVoidSchema> {
  constructor() {
    super("sale_voids", db.sale_voids);
  }

  /** Get the void record for a specific sale (if it exists) */
  async getBySaleId(saleId: string): Promise<SaleVoidSchema | undefined> {
    return db.sale_voids.where("saleId").equals(saleId).first();
  }

  /** Check whether a given sale has already been voided */
  async isSaleVoided(saleId: string): Promise<boolean> {
    const record = await this.getBySaleId(saleId);
    return record !== undefined;
  }

  /** All voids, most-recent first */
  async getAll(): Promise<SaleVoidSchema[]> {
    const all = await db.sale_voids.toArray();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const saleVoidsRepository = new SaleVoidsRepository();
