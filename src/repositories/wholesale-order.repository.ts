import { db } from "@/database/schema";
import type { WholesaleOrderSchema, WholesaleOrderStatus } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class WholesaleOrderRepository extends BaseRepository<WholesaleOrderSchema> {
  constructor() {
    super("wholesale_orders", db.wholesale_orders);
  }

  /** Find orders for a specific customer */
  async getByCustomerId(customerId: string): Promise<WholesaleOrderSchema[]> {
    const orders = await db.wholesale_orders.where("customerId").equals(customerId).toArray();
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Find orders by status */
  async getByStatus(status: WholesaleOrderStatus): Promise<WholesaleOrderSchema[]> {
    const orders = await db.wholesale_orders.where("status").equals(status).toArray();
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Generate unique wholesale order number e.g. ORD-000124 */
  async generateOrderNumber(): Promise<string> {
    const all = await this.getAll();
    const count = all.length + 10001;
    return `ORD-${String(count).slice(1)}`;
  }
}

export const wholesaleOrderRepository = new WholesaleOrderRepository();
