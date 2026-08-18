import { db } from "@/database/schema";
import type { WholesaleOrderItemSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class WholesaleOrderItemRepository extends BaseRepository<WholesaleOrderItemSchema> {
  constructor() {
    super("wholesale_order_items", db.wholesale_order_items);
  }

  /** Find line items for a specific order */
  async getByOrderId(orderId: string): Promise<WholesaleOrderItemSchema[]> {
    return db.wholesale_order_items.where("orderId").equals(orderId).toArray();
  }
}

export const wholesaleOrderItemRepository = new WholesaleOrderItemRepository();
