import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import type { InventoryBatchSchema } from "@/database/schema";

export interface FifoDeductionResult {
  allocations: Array<{
    batchId: string;
    batchNumber: string;
    quantityDeducted: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalCost: number;
  remainingRequired: number;
}

export class InventoryValuationService {
  /**
   * Allocate stock depletion using FIFO (First-In, First-Out) strategy.
   * Depletes batches ordered by expiryDate ASC (or createdAt ASC for non-expiry).
   */
  async allocateFifoDeduction(
    productId: string,
    branchId: string,
    requiredQuantity: number
  ): Promise<FifoDeductionResult> {
    const batches = await inventoryBatchRepository.getBatchesForProduct(productId, branchId);
    const activeBatches = batches.filter((b) => b.status === "active" && b.quantityOnHand > 0);

    let needed = requiredQuantity;
    let totalCost = 0;
    const allocations: FifoDeductionResult["allocations"] = [];

    for (const batch of activeBatches) {
      if (needed <= 0) break;

      const take = Math.min(needed, batch.quantityOnHand);
      const batchCost = take * batch.unitCost;

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantityDeducted: take,
        unitCost: batch.unitCost,
        totalCost: batchCost,
      });

      totalCost += batchCost;
      needed -= take;
    }

    return {
      allocations,
      totalCost,
      remainingRequired: Math.max(0, needed),
    };
  }

  /**
   * Execute actual FIFO deduction against active batches.
   */
  async executeFifoDeduction(
    productId: string,
    branchId: string,
    requiredQuantity: number
  ): Promise<FifoDeductionResult> {
    const plan = await this.allocateFifoDeduction(productId, branchId, requiredQuantity);

    if (plan.remainingRequired > 0) {
      throw new Error(
        `Insufficient batch inventory for FIFO deduction. Short by ${plan.remainingRequired} base units.`
      );
    }

    for (const alloc of plan.allocations) {
      await inventoryBatchRepository.deductFromBatch(alloc.batchId, alloc.quantityDeducted);
    }

    return plan;
  }
}

export const inventoryValuationService = new InventoryValuationService();
