import { BaseRepository } from "./base.repository";
import { db, type ProductPackagingSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";
import { SyncQueueService } from "@/services/sync/sync-queue";

export class ProductPackagingRepository extends BaseRepository<ProductPackagingSchema> {
  constructor() {
    super("product_packaging", db.product_packaging);
  }

  async getPackagingForProduct(productId: string): Promise<ProductPackagingSchema[]> {
    return db.product_packaging
      .where("productId")
      .equals(productId)
      .sortBy("sortOrder");
  }

  async getByProduct(productId: string): Promise<ProductPackagingSchema[]> {
    return this.getPackagingForProduct(productId);
  }

  /**
   * Replace all packaging levels for a product atomically.
   * Existing rows are deleted and fresh ones are inserted.
   * Pass an empty array to remove all packaging levels.
   */
  async setPackaging(
    productId: string,
    levels: Array<{ label: string; unitsPerPackage: number; sortOrder: number }>
  ): Promise<ProductPackagingSchema[]> {
    const existing = await this.getPackagingForProduct(productId);
    for (const pkg of existing) {
      await db.product_packaging.delete(pkg.id);
      await SyncQueueService.enqueue("product_packaging", "DELETE", { id: pkg.id, productId });
    }

    if (levels.length === 0) return [];

    const now = Date.now();
    const records: ProductPackagingSchema[] = levels.map((lvl) => ({
      id: crypto.randomUUID(),
      productId,
      label: lvl.label,
      unitsPerPackage: lvl.unitsPerPackage,
      sortOrder: lvl.sortOrder,
      createdAt: now,
      updatedAt: now,
      sync_status: "pending" as const,
    }));

    await db.product_packaging.bulkPut(records);
    for (const record of records) {
      await SyncQueueService.enqueue(
        "product_packaging",
        "UPSERT",
        record as unknown as Record<string, unknown>
      );
    }

    await DomainEvents.publish("PACKAGING_UPDATED", {
      entity: "ProductPackaging",
      entityId: productId,
      packaging: records,
    });

    return records;
  }

  /**
   * Convert a quantity in a given packaging label to the base unit.
   * Returns qty × unitsPerPackage for the matched level.
   * Returns null if the label is not found (treat as base-unit quantity in the caller).
   *
   * Example: convertToBase("prod-001", "Carton", 3) → 3 × 24 = 72
   */
  async convertToBase(
    productId: string,
    packagingLabel: string,
    qty: number
  ): Promise<number | null> {
    const levels = await this.getPackagingForProduct(productId);
    const level = levels.find(
      (l) => l.label.toLowerCase() === packagingLabel.toLowerCase()
    );
    if (!level) return null;
    return qty * level.unitsPerPackage;
  }
}

export const productPackagingRepository = new ProductPackagingRepository();
