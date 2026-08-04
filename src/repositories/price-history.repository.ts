import { db, type PriceHistorySchema } from "@/database/schema";

/**
 * Price history is APPEND-ONLY.
 * This repository does NOT extend BaseRepository because we never
 * update or delete historical price records — only insert new ones.
 */
export class PriceHistoryRepository {
  async addPriceRecord(
    data: Omit<PriceHistorySchema, "id" | "sync_status">
  ): Promise<PriceHistorySchema> {
    const record: PriceHistorySchema = {
      ...data,
      id: crypto.randomUUID(),
      sync_status: "pending",
    };
    await db.price_history.put(record);
    return record;
  }

  async getHistoryForProduct(productId: string): Promise<PriceHistorySchema[]> {
    const rows = await db.price_history
      .where("productId")
      .equals(productId)
      .toArray();
    // Sort descending by timestamp (most recent first)
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getHistoryByType(
    productId: string,
    priceType: PriceHistorySchema["priceType"]
  ): Promise<PriceHistorySchema[]> {
    const all = await this.getHistoryForProduct(productId);
    return all.filter((h) => h.priceType === priceType);
  }

  async getRecentHistory(limit = 50): Promise<PriceHistorySchema[]> {
    return db.price_history
      .orderBy("timestamp")
      .reverse()
      .limit(limit)
      .toArray();
  }
}

export const priceHistoryRepository = new PriceHistoryRepository();
