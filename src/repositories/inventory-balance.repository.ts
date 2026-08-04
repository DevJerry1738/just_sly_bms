import { db } from "@/database/schema";
import type { InventoryBalanceSchema, ProductSchema } from "@/database/schema";
import { branchRepository } from "./branch.repository";
import { productRepository } from "./product.repository";

export class InventoryBalanceRepository {
  async ensureSeedBalances(branchId?: string): Promise<InventoryBalanceSchema[]> {
    const targetBranchId = branchId || (await branchRepository.ensureSeedBranches()).find((b) => b.status === "active")?.id || "branch-hq-lagos";
    const existing = await db.inventory_balances.where("branchId").equals(targetBranchId).toArray();
    if (existing.length > 0) return existing;

    const products = (await productRepository.getAll()).filter((p) => p.status === "active");
    if (products.length === 0) return [];

    const now = Date.now();
    const records: InventoryBalanceSchema[] = products.map((product) => ({
      id: `${product.id}::${targetBranchId}`,
      productId: product.id,
      branchId: targetBranchId,
      quantityOnHand: Math.max(10, product.lowStockThreshold + 3),
      reservedQuantity: 0,
      incomingQuantity: 0,
      valuationMethod: "fifo",
      totalCostValue: Number(product.costPrice) * 10,
      weightedAvgCost: Number(product.costPrice),
      lastTransactionId: `seed-${product.id}`,
      updatedAt: now,
      sync_status: "synced",
    }));

    await db.inventory_balances.bulkPut(records);
    return records;
  }
  /** Get balance for a specific product/branch combo. */
  async getBalance(
    productId: string,
    branchId: string
  ): Promise<InventoryBalanceSchema | undefined> {
    const id = `${productId}::${branchId}`;
    return db.inventory_balances.get(id);
  }

  /** Get all balances for a branch. */
  async getByBranch(branchId: string): Promise<InventoryBalanceSchema[]> {
    return db.inventory_balances.where("branchId").equals(branchId).toArray();
  }

  /** Get all balances for a product across all branches. */
  async getByProduct(productId: string): Promise<InventoryBalanceSchema[]> {
    return db.inventory_balances.where("productId").equals(productId).toArray();
  }

  /** Get all balances (cross-branch). */
  async getAll(): Promise<InventoryBalanceSchema[]> {
    return db.inventory_balances.toArray();
  }

  /**
   * Items where quantityOnHand < product.lowStockThreshold.
   * Joins with products to check threshold.
   */
  async getLowStockItems(branchId?: string): Promise<
    Array<{ balance: InventoryBalanceSchema; product: ProductSchema }>
  > {
    const balances = branchId
      ? await this.getByBranch(branchId)
      : await this.getAll();

    const products = await db.products.toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const results: Array<{ balance: InventoryBalanceSchema; product: ProductSchema }> = [];
    for (const balance of balances) {
      const product = productMap.get(balance.productId);
      if (!product) continue;
      if (
        balance.quantityOnHand > 0 &&
        balance.quantityOnHand < product.lowStockThreshold
      ) {
        results.push({ balance, product });
      }
    }
    return results;
  }

  /** Items with zero stock. */
  async getOutOfStockItems(branchId?: string): Promise<
    Array<{ balance: InventoryBalanceSchema; product: ProductSchema }>
  > {
    const balances = branchId
      ? await this.getByBranch(branchId)
      : await this.getAll();

    const products = await db.products.toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    return balances
      .filter((b) => b.quantityOnHand <= 0)
      .map((balance) => ({ balance, product: productMap.get(balance.productId)! }))
      .filter((r) => !!r.product);
  }

  /** Summary stats for dashboard. */
  async getSummary(branchId?: string): Promise<{
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const balances = branchId
      ? await this.getByBranch(branchId)
      : await this.getAll();

    const products = await db.products
      .filter((p) => p.status === "active")
      .toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const seenProducts = new Set<string>();

    for (const b of balances) {
      const product = productMap.get(b.productId);
      if (!product) continue;
      seenProducts.add(b.productId);
      totalValue += b.totalCostValue;
      if (b.quantityOnHand <= 0) outOfStockCount++;
      else if (b.quantityOnHand < product.lowStockThreshold) lowStockCount++;
    }

    return {
      totalProducts: seenProducts.size,
      totalValue,
      lowStockCount,
      outOfStockCount,
    };
  }
}

export const inventoryBalanceRepository = new InventoryBalanceRepository();
