import { db } from "@/database/schema";
import type { SalesSchema, SaleItemSchema, SalePaymentSchema } from "@/database/schema";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";

export interface PosCartItem {
  productId: string;
  productName: string;
  baseUnit: string;
  packagingLabel?: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  baseRetailPrice: number;
  costPrice: number;
  availablePackaging?: Array<{ label: string; unitsPerPackage: number }>;
}

export interface CompleteSaleInput {
  branchId: string;
  createdBy: string;
  createdByName?: string;
  items: PosCartItem[];
  paymentMethod: "cash" | "bank_transfer" | "card" | "mixed";
  amountTendered?: number;
  discountAmount?: number;
  notes?: string;
  saleNumber?: string;
}

export class PosService {
  async createDraftSale(input: CompleteSaleInput): Promise<SalesSchema> {
    const saleId = crypto.randomUUID();
    const now = Date.now();
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount = input.discountAmount ?? 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);

    const sale: SalesSchema = {
      id: saleId,
      branchId: input.branchId,
      saleNumber: input.saleNumber ?? `POS-${String(now).slice(-6)}`,
      status: "completed",
      paymentStatus: input.paymentMethod === "cash" ? "paid" : "pending",
      subtotal,
      discountAmount,
      totalAmount,
      amountTendered: input.amountTendered ?? totalAmount,
      currency: "USD",
      paymentMethod: input.paymentMethod,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    // Collect inventory records to write after the main transaction closes.
    // inventoryTransactionRepository.recordTransaction() internally enqueues to
    // db.syncQueue, which must NOT be accessed inside a Dexie transaction that
    // doesn't list it — that would throw "object store not found".
    const inventoryRecords: Array<{
      productId: string;
      productName: string;
      baseQuantity: number;
      costPrice: number;
    }> = [];

    await db.transaction("rw", [db.sales, db.sale_items, db.sale_payments, db.inventory_transactions, db.inventory_balances, db.syncQueue], async () => {
      await db.sales.put(sale);

      for (const item of input.items) {
        const baseQuantity = item.baseQuantity || item.quantity;
        const saleItem: SaleItemSchema = {
          id: crypto.randomUUID(),
          saleId,
          productId: item.productId,
          productName: item.productName,
          packagingLabel: item.packagingLabel,
          quantity: item.quantity,
          baseQuantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          subtotal: item.unitPrice * item.quantity,
          createdAt: now,
          sync_status: "pending",
        };
        await db.sale_items.put(saleItem);

        const balance = await inventoryBalanceRepository.getBalance(item.productId, input.branchId);
        if (!balance || balance.quantityOnHand < baseQuantity) {
          throw new Error(`Insufficient stock for ${item.productName}`);
        }

        inventoryRecords.push({
          productId: item.productId,
          productName: item.productName,
          baseQuantity,
          costPrice: item.costPrice,
        });
      }

      const payment: SalePaymentSchema = {
        id: crypto.randomUUID(),
        saleId,
        method: input.paymentMethod === "mixed" ? "cash" : input.paymentMethod,
        status: input.paymentMethod === "cash" ? "paid" : "pending",
        amount: totalAmount,
        reference: sale.saleNumber,
        createdAt: now,
        sync_status: "pending",
      };
      await db.sale_payments.put(payment);
    });

    // Record inventory transactions AFTER the outer Dexie transaction has
    // committed. recordTransaction() opens its own transaction and then calls
    // SyncQueueService.enqueue — both are safe here since we are no longer
    // inside any Dexie transaction scope.
    for (const rec of inventoryRecords) {
      await inventoryTransactionRepository.recordTransaction({
        type: "sale",
        productId: rec.productId,
        branchId: input.branchId,
        quantity: -rec.baseQuantity,
        baseUnit: "base",
        unitCost: rec.costPrice,
        notes: `POS sale ${sale.saleNumber}`,
        performedBy: input.createdBy,
        performedByName: input.createdByName,
        referenceNumber: sale.saleNumber,
      });
    }

    await SyncQueueService.enqueue("sales", "CREATE", sale as unknown as Record<string, unknown>, { branchId: input.branchId });
    await SyncQueueService.enqueue("sale_items", "CREATE", { saleId, items: input.items }, { branchId: input.branchId });
    await SyncQueueService.enqueue("sale_payments", "CREATE", { saleId, paymentMethod: input.paymentMethod }, { branchId: input.branchId });

    await DomainEvents.publish("SALE_COMPLETED", {
      entity: "Sale",
      entityId: saleId,
      record: sale,
    }, { userId: input.createdBy, branchId: input.branchId });

    return sale;
  }

  async validateCartItem(productId: string, branchId: string, requestedQty: number, packagingLabel?: string): Promise<{ ok: boolean; error?: string; baseQuantity?: number }> {
    const balance = await inventoryBalanceRepository.getBalance(productId, branchId);
    if (!balance) {
      return { ok: false, error: "No inventory balance found for this product." };
    }

    let baseQuantity = requestedQty;
    if (packagingLabel) {
      const converted = await productPackagingRepository.convertToBase(productId, packagingLabel, requestedQty);
      if (converted !== null) {
        baseQuantity = converted;
      }
    }

    if (baseQuantity > balance.quantityOnHand) {
      return { ok: false, error: `Only ${balance.quantityOnHand} units available.` };
    }

    return { ok: true, baseQuantity };
  }
}

export const posService = new PosService();
