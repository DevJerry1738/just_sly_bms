import { db } from "@/database/schema";
import type { SaleVoidSchema } from "@/database/schema";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { saleItemsRepository } from "@/repositories/sale-items.repository";
import { saleVoidsRepository } from "@/repositories/sale-voids.repository";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

export interface VoidSaleInput {
  saleId: string;
  reason: string;
  voidedBy: string;
  voidedByName?: string;
  branchId: string;
}

export interface VoidSaleResult {
  success: boolean;
  error?: string;
  voidRecord?: SaleVoidSchema;
}

export class VoidService {
  /**
   * Void a completed sale.
   * - Validates sale exists and is not already voided
   * - Reverses inventory (positive quantity = stock return) for each line item
   * - Records a sale_void entry
   * - Updates sale status to "voided"
   * - Enqueues sync for all mutations
   * - Publishes SALE_VOIDED domain event
   */
  async voidSale(input: VoidSaleInput): Promise<VoidSaleResult> {
    const sale = await db.sales.get(input.saleId);

    if (!sale) {
      return { success: false, error: "Sale not found." };
    }

    if (sale.status === "voided") {
      return { success: false, error: "This sale has already been voided." };
    }

    if (sale.status === "draft") {
      return { success: false, error: "Draft sales cannot be voided." };
    }

    // Check if a void record already exists (belt-and-suspenders guard)
    const alreadyVoided = await saleVoidsRepository.isSaleVoided(input.saleId);
    if (alreadyVoided) {
      return { success: false, error: "This sale has already been voided." };
    }

    // Fetch all sale line items
    const items = await saleItemsRepository.getBySaleId(input.saleId);
    if (items.length === 0) {
      return { success: false, error: "No sale items found — cannot reverse inventory." };
    }

    const now = Date.now();

    // Reverse inventory for every line item (positive qty = stock back in)
    for (const item of items) {
      const baseQuantity = item.baseQuantity ?? item.quantity;
      await inventoryTransactionRepository.recordTransaction({
        type: "customer_return",
        productId: item.productId,
        branchId: input.branchId,
        quantity: +baseQuantity,          // positive = stock returning
        baseUnit: "base",
        unitCost: item.costPrice,
        notes: `Void of sale ${sale.saleNumber} — ${input.reason}`,
        performedBy: input.voidedBy,
        performedByName: input.voidedByName,
        referenceNumber: `VOID-${sale.saleNumber}`,
      });
    }

    // Write void record
    const voidRecord: SaleVoidSchema = {
      id: crypto.randomUUID(),
      saleId: input.saleId,
      reason: input.reason,
      voidedBy: input.voidedBy,
      createdAt: now,
      inventoryReversed: true,
      sync_status: "pending",
    };
    await db.sale_voids.put(voidRecord);
    await SyncQueueService.enqueue(
      "sale_voids",
      "CREATE",
      voidRecord as unknown as Record<string, unknown>,
      { branchId: input.branchId }
    );

    // Mark sale as voided
    const updatedSale = {
      ...sale,
      status: "voided" as const,
      voidedAt: now,
      updatedAt: now,
      sync_status: "pending" as const,
    };
    await db.sales.put(updatedSale);
    await SyncQueueService.enqueue(
      "sales",
      "UPDATE",
      updatedSale as unknown as Record<string, unknown>,
      { branchId: input.branchId }
    );

    // Publish domain event for audit logger
    await DomainEvents.publish(
      "SALE_VOIDED",
      {
        entity: "Sale",
        entityId: input.saleId,
        record: updatedSale,
        voidRecord,
        reason: input.reason,
      },
      { userId: input.voidedBy, branchId: input.branchId }
    );

    return { success: true, voidRecord };
  }
}

export const voidService = new VoidService();
