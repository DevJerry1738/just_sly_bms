import { BaseRepository } from "./base.repository";
import { db, type ProductSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";
import { priceHistoryRepository } from "./price-history.repository";
import { productPackagingRepository } from "./product-packaging.repository";
import { categoryRepository } from "./category.repository";
import { unitOfMeasureRepository } from "./unit-of-measure.repository";
import type { ProductPackagingSchema } from "@/database/schema";

// ---------------------------------------------------------------------------
// Code generation helpers
// ---------------------------------------------------------------------------

async function getProductCodePrefix(): Promise<string> {
  const orgs = await db.organizations.toArray();
  const org = orgs[0];
  return (org?.product_code_prefix as string | undefined) ?? "JSP";
}

export async function generateProductCode(): Promise<string> {
  const prefix = await getProductCodePrefix();
  const all = await db.products.toArray();

  // Extract numeric suffix from existing codes matching this prefix pattern
  const nums = all
    .map((p) => {
      const match = p.code?.match(/^(\w+)-(\d+)$/);
      if (match && match[1] === prefix) return parseInt(match[2], 10);
      return 0;
    })
    .filter(Boolean);

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function isProductCodeUnique(code: string, excludeId?: string): Promise<boolean> {
  const all = await db.products.toArray();
  return !all.some((p) => p.code === code && p.id !== excludeId);
}

// ---------------------------------------------------------------------------
// ProductRepository
// ---------------------------------------------------------------------------

export interface CreateProductInput {
  code?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  brand?: string;
  manufacturer?: string;
  baseUnit: string;
  trackExpiry?: boolean;
  lowStockThreshold?: number;
  costPrice: number | null;
  retailPrice: number;
  wholesalePrice: number;
  supplyPrice: number;
  packaging?: Array<{ label: string; unitsPerPackage: number; sortOrder: number }>;
  createdByUserId?: string;
  createdByName?: string;
}

export class ProductRepository extends BaseRepository<ProductSchema> {
  constructor() {
    super("products", db.products);
  }

  async ensureSeedProducts(): Promise<ProductSchema[]> {
    const existing = await db.products.count();
    if (existing === 0) {
      await categoryRepository.ensureSeedCategories();
      await unitOfMeasureRepository.ensureSeedUnits();

      const now = Date.now();
      const records: ProductSchema[] = [
        {
          id: "prod-demo-001",
          code: "JSP-0001",
          sku: "SKU-001",
          barcode: "750000000001",
          name: "Starter Pack",
          description: "Sample starter product for demo inventory",
          categoryId: "cat-consumables",
          brand: "Just Sly",
          baseUnit: "Piece",
          trackExpiry: false,
          lowStockThreshold: 5,
          costPrice: 1200,
          retailPrice: 1500,
          wholesalePrice: 1350,
          supplyPrice: 1250,
          status: "active",
          createdAt: now,
          updatedAt: now,
          sync_status: "synced",
        },
        {
          id: "prod-demo-002",
          code: "JSP-0002",
          sku: "SKU-002",
          barcode: "750000000002",
          name: "Daily Essentials",
          description: "Sample product for inventory visibility",
          categoryId: "cat-general",
          brand: "Just Sly",
          baseUnit: "Piece",
          trackExpiry: false,
          lowStockThreshold: 8,
          costPrice: 800,
          retailPrice: 1000,
          wholesalePrice: 900,
          supplyPrice: 850,
          status: "active",
          createdAt: now,
          updatedAt: now,
          sync_status: "synced",
        },
      ];
      await db.products.bulkPut(records);
    }
    return db.products.toArray();
  }

  private isSeedProduct(product: ProductSchema): boolean {
    return product.id.startsWith("prod-demo-");
  }

  private filterSeedProducts(products: ProductSchema[]): ProductSchema[] {
    const custom = products.filter((product) => !this.isSeedProduct(product));
    return custom.length > 0 ? custom : products;
  }

  async getAll(): Promise<ProductSchema[]> {
    const all = await db.products.toArray();
    return this.filterSeedProducts(all);
  }

  async getActiveProducts(): Promise<ProductSchema[]> {
    const all = await this.getAll();
    return all.filter((p) => p.status === "active");
  }

  async getByCategory(categoryId: string): Promise<ProductSchema[]> {
    const results = await db.products
      .where("categoryId")
      .equals(categoryId)
      .filter((p) => p.status === "active")
      .toArray();
    return this.filterSeedProducts(results);
  }

  /**
   * Full-text search across name, code, SKU, and barcode.
   */
  async searchProducts(query: string): Promise<ProductSchema[]> {
    const q = query.toLowerCase();
    const all = await this.getAll();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }

  /**
   * Create a product with automatic code generation, packaging setup, and
   * initial price history entries for all four price types.
   */
  async createProduct(
    data: CreateProductInput
  ): Promise<{ product: ProductSchema; packaging: ProductPackagingSchema[] }> {
    const code = data.code ?? (await generateProductCode());
    const now = Date.now();

    const product: ProductSchema = {
      id: crypto.randomUUID(),
      code,
      sku: data.sku ?? code,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId ?? null,
      brand: data.brand,
      baseUnit: data.baseUnit,
      trackExpiry: data.trackExpiry ?? false,
      lowStockThreshold: data.lowStockThreshold ?? 0,
      costPrice: data.costPrice,
      retailPrice: data.retailPrice,
      wholesalePrice: data.wholesalePrice,
      supplyPrice: data.supplyPrice,
      status: "active",
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    const saved = await this.create(product);

    // Record initial price history for all four price types
    const priceTypes: Array<{ type: "cost" | "retail" | "wholesale" | "supply"; value: number }> = [
      { type: "cost", value: data.costPrice ?? 0 },
      { type: "retail", value: data.retailPrice },
      { type: "wholesale", value: data.wholesalePrice },
      { type: "supply", value: data.supplyPrice },
    ];
    for (const pt of priceTypes) {
      await priceHistoryRepository.addPriceRecord({
        productId: saved.id,
        priceType: pt.type,
        previousPrice: 0,
        newPrice: pt.value,
        changedBy: data.createdByUserId ?? "system",
        changedByName: data.createdByName,
        reason: "Initial price on creation",
        timestamp: now,
      });
    }

    // Set packaging levels if provided
    let packaging: ProductPackagingSchema[] = [];
    if (data.packaging && data.packaging.length > 0) {
      packaging = await productPackagingRepository.setPackaging(saved.id, data.packaging);
    }

    await DomainEvents.publish("PRODUCT_CREATED", {
      entity: "Product",
      entityId: saved.id,
      record: saved,
    });

    return { product: saved, packaging };
  }

  /**
   * Update a product. Automatically records price history entries for any
   * price fields that have changed.
   */
  async updateProduct(
    id: string,
    updates: Partial<CreateProductInput> & { updatedByUserId?: string; updatedByName?: string; priceChangeReason?: string }
  ): Promise<{ product: ProductSchema; packaging: ProductPackagingSchema[] }> {
    const before = await this.getById(id);
    if (!before) throw new Error(`Product ${id} not found`);

    const now = Date.now();
    const patch: Partial<ProductSchema> = {
      ...(updates.sku !== undefined && { sku: updates.sku }),
      ...(updates.barcode !== undefined && { barcode: updates.barcode }),
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
      ...(updates.brand !== undefined && { brand: updates.brand }),
      ...(updates.baseUnit !== undefined && { baseUnit: updates.baseUnit }),
      ...(updates.trackExpiry !== undefined && { trackExpiry: updates.trackExpiry }),
      ...(updates.lowStockThreshold !== undefined && { lowStockThreshold: updates.lowStockThreshold }),
      ...(updates.costPrice !== undefined && { costPrice: updates.costPrice }),
      ...(updates.retailPrice !== undefined && { retailPrice: updates.retailPrice }),
      ...(updates.wholesalePrice !== undefined && { wholesalePrice: updates.wholesalePrice }),
      ...(updates.supplyPrice !== undefined && { supplyPrice: updates.supplyPrice }),
      updatedAt: now,
      sync_status: "pending",
    };

    const updated = await this.update(id, patch);

    // Record price history for any changed price fields
    const priceFields: Array<{ type: "cost" | "retail" | "wholesale" | "supply"; key: keyof ProductSchema }> = [
      { type: "cost", key: "costPrice" },
      { type: "retail", key: "retailPrice" },
      { type: "wholesale", key: "wholesalePrice" },
      { type: "supply", key: "supplyPrice" },
    ];
    for (const pf of priceFields) {
      const prev = Number(before[pf.key] ?? 0);
      const next = Number(updated[pf.key] ?? 0);
      if (prev !== next) {
        await priceHistoryRepository.addPriceRecord({
          productId: id,
          priceType: pf.type,
          previousPrice: prev,
          newPrice: next,
          changedBy: updates.updatedByUserId ?? "system",
          changedByName: updates.updatedByName,
          reason: updates.priceChangeReason,
          timestamp: now,
        });
      }
    }

    // Update packaging if provided
    let packaging: ProductPackagingSchema[] = await productPackagingRepository.getPackagingForProduct(id);
    if (updates.packaging !== undefined) {
      packaging = await productPackagingRepository.setPackaging(id, updates.packaging);
    }

    await DomainEvents.publish("PRODUCT_UPDATED", {
      entity: "Product",
      entityId: id,
      before,
      after: updated,
    });

    return { product: updated, packaging };
  }

  /** Archive a product — sets status to "archived". Archived products cannot be sold or transferred. */
  async archiveProduct(id: string, archivedByUserId?: string): Promise<ProductSchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, {
      status: "archived",
      updatedAt: Date.now(),
      sync_status: "pending",
    });
    await DomainEvents.publish("PRODUCT_ARCHIVED", {
      entity: "Product",
      entityId: id,
      before,
      archivedBy: archivedByUserId,
    });
    return updated;
  }

  /** Restore an archived product back to active status. */
  async restoreProduct(id: string): Promise<ProductSchema> {
    const updated = await this.update(id, {
      status: "active",
      updatedAt: Date.now(),
      sync_status: "pending",
    });
    await DomainEvents.publish("PRODUCT_RESTORED", { entity: "Product", entityId: id });
    return updated;
  }
}

export const productRepository = new ProductRepository();
