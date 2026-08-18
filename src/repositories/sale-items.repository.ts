import { db } from "@/database/schema";
import type { SaleItemSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class SaleItemsRepository extends BaseRepository<SaleItemSchema> {
  constructor() {
    super("sale_items", db.sale_items);
  }

  /** All items belonging to a specific sale */
  async getBySaleId(saleId: string): Promise<SaleItemSchema[]> {
    return db.sale_items.where("saleId").equals(saleId).toArray();
  }

  /** All items for a given product (cross-sale) */
  async getByProductId(productId: string): Promise<SaleItemSchema[]> {
    return db.sale_items.where("productId").equals(productId).toArray();
  }
}

export const saleItemsRepository = new SaleItemsRepository();
