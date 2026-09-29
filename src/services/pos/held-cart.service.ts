import { db, type HeldCartSchema } from "@/database/schema";
import type { PosCartItem } from "./pos.service";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";

export interface HoldCartInput {
  branchId: string;
  heldByUserId: string;
  heldByUserName?: string;
  referenceLabel?: string;
  notes?: string;
  items: PosCartItem[];
}

export interface ResumedCartResult {
  cart: PosCartItem[];
  warnings: string[];
}

export class HeldCartService {
  /**
   * Parks the current cart items into the held_carts table.
   */
  async holdCart(input: HoldCartInput): Promise<HeldCartSchema> {
    if (!input.items || input.items.length === 0) {
      throw new Error("Cannot hold an empty cart.");
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const totalItems = input.items.reduce((sum, item) => sum + item.quantity, 0);

    const defaultLabel = `Held #${new Date(now).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const heldCart: HeldCartSchema = {
      id,
      branchId: input.branchId,
      referenceLabel: input.referenceLabel?.trim() || defaultLabel,
      notes: input.notes?.trim() || undefined,
      items: input.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        baseUnit: i.baseUnit,
        packagingLabel: i.packagingLabel,
        quantity: i.quantity,
        baseQuantity: i.baseQuantity,
        unitPrice: i.unitPrice,
        baseRetailPrice: i.baseRetailPrice,
        costPrice: i.costPrice,
        availablePackaging: i.availablePackaging,
      })),
      subtotal,
      totalItems,
      heldByUserId: input.heldByUserId,
      heldByUserName: input.heldByUserName,
      createdAt: now,
      updatedAt: now,
    };

    await db.held_carts.put(heldCart);
    return heldCart;
  }

  /**
   * Retrieves all held carts for a branch, ordered newest first.
   */
  async getHeldCarts(branchId: string): Promise<HeldCartSchema[]> {
    const carts = await db.held_carts
      .where("branchId")
      .equals(branchId)
      .toArray();

    return carts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Gets the count of held carts for a branch.
   */
  async getHeldCartsCount(branchId: string): Promise<number> {
    return await db.held_carts.where("branchId").equals(branchId).count();
  }

  /**
   * Resumes a held cart:
   * 1. Validates current stock for each item against the active branch.
   * 2. Flags or adjusts any item if stock changed while cart was held.
   * 3. Deletes the held cart record upon resumption.
   */
  async resumeHeldCart(
    heldCartId: string,
    currentBranchId: string
  ): Promise<ResumedCartResult> {
    const held = await db.held_carts.get(heldCartId);
    if (!held) {
      throw new Error("Held transaction not found or already resumed.");
    }

    const resumedCart: PosCartItem[] = [];
    const warnings: string[] = [];

    for (const item of held.items) {
      const balance = await inventoryBalanceRepository.getBalance(
        item.productId,
        currentBranchId
      );

      const availableOnHand = balance ? balance.quantityOnHand : 0;
      let unitsPerPackage = 1;

      if (item.packagingLabel && item.availablePackaging) {
        const pkg = item.availablePackaging.find(
          (p) => p.label.toLowerCase() === item.packagingLabel?.toLowerCase()
        );
        if (pkg) unitsPerPackage = pkg.unitsPerPackage;
      }

      const requestedBaseQty = item.quantity * unitsPerPackage;

      if (availableOnHand <= 0) {
        warnings.push(
          `"${item.productName}" is completely out of stock and was removed from the resumed cart.`
        );
        continue;
      }

      if (availableOnHand < requestedBaseQty) {
        const maxPackages = Math.floor(availableOnHand / unitsPerPackage);
        if (maxPackages < 1) {
          warnings.push(
            `"${item.productName}" has insufficient stock (${availableOnHand} units) for packaging "${item.packagingLabel}". Removed from cart.`
          );
          continue;
        }

        warnings.push(
          `"${item.productName}" quantity adjusted from ${item.quantity} to ${maxPackages} due to limited stock.`
        );

        resumedCart.push({
          ...item,
          quantity: maxPackages,
          baseQuantity: maxPackages * unitsPerPackage,
        });
      } else {
        resumedCart.push({
          ...item,
          quantity: item.quantity,
          baseQuantity: requestedBaseQty,
        });
      }
    }

    // Delete held record once resumed
    await db.held_carts.delete(heldCartId);

    return {
      cart: resumedCart,
      warnings,
    };
  }

  /**
   * Discards a held transaction.
   */
  async deleteHeldCart(heldCartId: string): Promise<void> {
    await db.held_carts.delete(heldCartId);
  }
}

export const heldCartService = new HeldCartService();
