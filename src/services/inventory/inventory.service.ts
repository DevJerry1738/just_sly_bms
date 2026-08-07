import { db, type BranchSchema, type CategorySchema, type ProductSchema, type UnitOfMeasureSchema } from "@/database/schema";
import { categoryRepository } from "@/repositories/category.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { productRepository } from "@/repositories/product.repository";
import { unitOfMeasureRepository } from "@/repositories/unit-of-measure.repository";

function normalizeCategoryValue(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function humanizeCategory(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "Uncategorized";

  const aliasMap: Record<string, string> = {
    "cat general": "General",
    "cat consumables": "Consumables",
    general: "General",
    consumables: "Consumables",
  };

  const normalized = normalizeCategoryValue(raw);
  if (aliasMap[normalized]) return aliasMap[normalized];

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface InventoryItem {
  productId: string;
  productCode: string;
  barcode?: string;
  name: string;
  image?: string;
  category?: CategorySchema;
  unit?: UnitOfMeasureSchema;
  sellingPrice: number;
  wholesalePrice: number;
  costPrice: number;
  reorderThreshold: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  branchId: string;
  status: "active" | "archived" | "draft";
  lastUpdated: number;
}

export interface InventoryQueryResult {
  items: InventoryItem[];
  products: ProductSchema[];
  balances: Array<{ productId: string; branchId: string; quantityOnHand: number; reservedQuantity: number; updatedAt: number }>;
  categories: CategorySchema[];
  units: UnitOfMeasureSchema[];
  branch: BranchSchema | null;
}

class InventoryService {
  async getInventory(branchId: string): Promise<InventoryQueryResult> {
    // Guard against SSR environments where IndexedDB is unavailable
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return {
        items: [],
        products: [],
        balances: [],
        categories: [],
        units: [],
        branch: null,
      };
    }

    const [products, balances, categories, units] = await Promise.all([
      productRepository.getAll(),
      inventoryBalanceRepository.getByBranch(branchId),
      categoryRepository.getActiveCategories(),
      unitOfMeasureRepository.getActiveUnits(),
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const resolvedCategories = [...categories];
    const categoryMap = new Map(resolvedCategories.map((category) => [category.id, category]));
    const storedCategories = await db.categories.toArray();
    const storedCategoryMap = new Map(storedCategories.map((category) => [category.id, category]));
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));

    const items: InventoryItem[] = products
      .filter((product) => product.status === "active")
      .map((product) => {
        const balance = balances.find((entry) => entry.productId === product.id);
        const currentStock = balance?.quantityOnHand ?? 0;
        const reservedStock = balance?.reservedQuantity ?? 0;
        let resolvedCategory = product.categoryId ? categoryMap.get(product.categoryId) : undefined;

        if (!resolvedCategory && product.categoryId) {
          const storedCategory = storedCategoryMap.get(product.categoryId);
          if (storedCategory && storedCategory.status === "active") {
            resolvedCategory = storedCategory;
          }
        }

        if (!resolvedCategory && product.categoryId) {
          const categoryKey = normalizeCategoryValue(product.categoryId);
          resolvedCategory = resolvedCategories.find(
            (category) =>
              normalizeCategoryValue(category.id) === categoryKey ||
              normalizeCategoryValue(category.name) === categoryKey ||
              normalizeCategoryValue(category.code) === categoryKey
          );
        }

        if (!resolvedCategory && product.categoryId) {
          resolvedCategory = {
            id: product.categoryId,
            code: product.categoryId,
            name: humanizeCategory(product.categoryId),
            parentId: null,
            description: "Auto-resolved from product",
            status: "active",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sync_status: "synced",
          } as CategorySchema;
          resolvedCategories.push(resolvedCategory);
          categoryMap.set(product.categoryId, resolvedCategory);
        }

        return {
          productId: product.id,
          productCode: product.code || product.sku || product.id,
          barcode: product.barcode,
          name: product.name,
          category: resolvedCategory,
          unit: product.baseUnit ? unitMap.get(product.baseUnit) : undefined,
          sellingPrice: Number(product.retailPrice ?? 0),
          wholesalePrice: Number(product.wholesalePrice ?? 0),
          costPrice: Number(product.costPrice ?? 0),
          reorderThreshold: Number(product.lowStockThreshold ?? 0),
          currentStock,
          reservedStock,
          availableStock: Math.max(0, currentStock - reservedStock),
          branchId,
          status: product.status,
          lastUpdated: balance?.updatedAt ?? product.updatedAt ?? Date.now(),
        };
      });

    const branch = typeof window !== "undefined" && typeof indexedDB !== "undefined"
      ? (await db.branches.get(branchId)) ?? null
      : null;

    return {
      items,
      products,
      balances: balances.map((balance) => ({
        productId: balance.productId,
        branchId: balance.branchId,
        quantityOnHand: balance.quantityOnHand,
        reservedQuantity: balance.reservedQuantity,
        updatedAt: balance.updatedAt,
      })),
      categories: resolvedCategories,
      units,
      branch,
    };
  }
}

export const inventoryService = new InventoryService();
