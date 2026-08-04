import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { inventoryReservationRepository } from "@/repositories/inventory-reservation.repository";

export class InventoryBalanceService {
  /**
   * Get the current balance (on-hand quantity) for a product at a branch
   * Based on sum of all inventory transactions for that product/branch
   */
  async getBalance(productId: string, branchId: string): Promise<number> {
    const transactions = await inventoryTransactionRepository.getByProductAndBranch(
      productId,
      branchId
    );

    // Sum all transactions: inbound (+) and outbound (-)
    const onHand = transactions.reduce((sum, txn) => {
      const quantity = txn.quantityInBaseUnit || 0;
      if (
        txn.transactionType === "opening_balance" ||
        txn.transactionType === "purchase_received" ||
        txn.transactionType === "branch_transfer_in" ||
        txn.transactionType === "adjustment_increase" ||
        txn.transactionType === "return_from_customer"
      ) {
        return sum + quantity;
      } else if (
        txn.transactionType === "sales_order" ||
        txn.transactionType === "branch_transfer_out" ||
        txn.transactionType === "adjustment_decrease" ||
        txn.transactionType === "damage_loss" ||
        txn.transactionType === "sample_distribution"
      ) {
        return sum - quantity;
      }
      return sum;
    }, 0);

    return Math.max(0, onHand); // Never negative
  }

  /**
   * Get reserved quantity for a product at a branch
   * This is the sum of all unreleased reservations
   */
  async getReservedQuantity(productId: string, branchId: string): Promise<number> {
    return inventoryReservationRepository.getReservedQuantity(productId, branchId);
  }

  /**
   * Get available quantity (on-hand minus reserved)
   */
  async getAvailableQuantity(productId: string, branchId: string): Promise<number> {
    const onHand = await this.getBalance(productId, branchId);
    const reserved = await this.getReservedQuantity(productId, branchId);
    return Math.max(0, onHand - reserved);
  }

  /**
   * Check if sufficient quantity is available
   */
  async hasAvailableQuantity(
    productId: string,
    branchId: string,
    requiredQuantity: number
  ): Promise<boolean> {
    const available = await this.getAvailableQuantity(productId, branchId);
    return available >= requiredQuantity;
  }
}

export const inventoryBalanceService = new InventoryBalanceService();
