import { BaseRepository } from "./base.repository";
import {
  db,
  type ProductSchema,
  type InventorySchema,
  type SalesSchema,
  type OrdersSchema,
  type CustomersSchema,
  type NotificationsSchema,
} from "@/database/schema";

export class ProductsRepository extends BaseRepository<ProductSchema> {
  constructor() {
    super("products", db.products);
  }

  async getBySku(sku: string): Promise<ProductSchema | undefined> {
    return db.products.where("sku").equals(sku).first();
  }
}

export class InventoryRepository extends BaseRepository<InventorySchema> {
  constructor() {
    super("inventory", db.inventory);
  }

  async getByBranch(branchId: string): Promise<InventorySchema[]> {
    return db.inventory.where("branchId").equals(branchId).toArray();
  }
}

export class SalesRepository extends BaseRepository<SalesSchema> {
  constructor() {
    super("sales", db.sales);
  }
}

export class OrdersRepository extends BaseRepository<OrdersSchema> {
  constructor() {
    super("orders", db.orders);
  }
}

export class CustomersRepository extends BaseRepository<CustomersSchema> {
  constructor() {
    super("customers", db.customers);
  }
}

export class NotificationsRepository extends BaseRepository<NotificationsSchema> {
  constructor() {
    super("notifications", db.notifications);
  }
}

// Singleton instances for feature module injection
export const productsRepository = new ProductsRepository();
export const inventoryRepository = new InventoryRepository();
export const salesRepository = new SalesRepository();
export const ordersRepository = new OrdersRepository();
export const customersRepository = new CustomersRepository();
export const notificationsRepository = new NotificationsRepository();
