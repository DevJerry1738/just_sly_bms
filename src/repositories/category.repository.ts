import { BaseRepository } from "./base.repository";
import { db, type CategorySchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";

export const DEFAULT_CATEGORIES: Omit<CategorySchema, "createdAt" | "updatedAt" | "sync_status">[] = [
  { id: "cat-general", code: "CAT-0001", name: "General", parentId: null, description: "Default general products", status: "active" },
  { id: "cat-consumables", code: "CAT-0002", name: "Consumables", parentId: null, description: "Fast-moving consumables", status: "active" },
];

function generateCategoryCode(count: number): string {
  return `CAT-${String(count + 1).padStart(4, "0")}`;
}

export class CategoryRepository extends BaseRepository<CategorySchema> {
  constructor() {
    super("categories", db.categories);
  }

  async ensureSeedCategories(): Promise<CategorySchema[]> {
    const existingCategories = await db.categories.toArray();
    const hasActiveCategories = existingCategories.some((category) => category.status === "active");

    if (!hasActiveCategories) {
      const now = Date.now();
      const records: CategorySchema[] = DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        createdAt: now,
        updatedAt: now,
        sync_status: "synced" as const,
      }));
      await db.categories.bulkPut(records);
    }
    return db.categories.toArray();
  }

  async getActiveCategories(): Promise<CategorySchema[]> {
    const all = await this.ensureSeedCategories();
    return all.filter((c) => c.status === "active");
  }

  async getRootCategories(): Promise<CategorySchema[]> {
    const all = await this.getActiveCategories();
    return all.filter((c) => !c.parentId);
  }

  async getByParent(parentId: string): Promise<CategorySchema[]> {
    return db.categories
      .where("parentId")
      .equals(parentId)
      .filter((c) => c.status === "active")
      .toArray();
  }

  async searchCategories(query: string): Promise<CategorySchema[]> {
    const q = query.toLowerCase();
    const all = await this.getAll();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }

  async getProductCount(categoryId: string): Promise<number> {
    return db.products
      .where("categoryId")
      .equals(categoryId)
      .filter((p) => p.status === "active")
      .count();
  }

  async createCategory(data: Partial<CategorySchema>): Promise<CategorySchema> {
    const count = (await this.getAll()).length;
    const code = data.code ?? generateCategoryCode(count);
    const now = Date.now();

    const category: CategorySchema = {
      id: data.id ?? crypto.randomUUID(),
      code,
      name: data.name ?? "",
      parentId: data.parentId ?? null,
      description: data.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    const saved = await this.create(category);
    await DomainEvents.publish("CATEGORY_CREATED", { entity: "Category", entityId: saved.id, record: saved });
    return saved;
  }

  async updateCategory(id: string, updates: Partial<CategorySchema>): Promise<CategorySchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { ...updates, updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("CATEGORY_UPDATED", { entity: "Category", entityId: id, before, after: updated });
    return updated;
  }

  async archiveCategory(id: string): Promise<CategorySchema> {
    const before = await this.getById(id);
    const updated = await this.update(id, { status: "archived", updatedAt: Date.now(), sync_status: "pending" });
    await DomainEvents.publish("CATEGORY_ARCHIVED", { entity: "Category", entityId: id, before });
    return updated;
  }
}

export const categoryRepository = new CategoryRepository();
