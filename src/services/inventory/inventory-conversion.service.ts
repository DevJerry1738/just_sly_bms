import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { productRepository } from "@/repositories/product.repository";

export class InventoryConversionService {
  /**
   * Convert a quantity given in a specified packaging unit (e.g. "Carton") to the product's base unit.
   * If no packagingLabel is provided or if it matches the base unit, returns the quantity unchanged.
   */
  async convertToBaseUnits(
    productId: string,
    quantity: number,
    packagingLabel?: string
  ): Promise<number> {
    if (!packagingLabel || quantity === 0) return quantity;

    const product = await productRepository.getById(productId);
    if (!product) return quantity;

    if (packagingLabel.toLowerCase() === product.baseUnit.toLowerCase()) {
      return quantity;
    }

    const baseQty = await productPackagingRepository.convertToBase(
      productId,
      packagingLabel,
      quantity
    );

    return baseQty ?? quantity;
  }

  /**
   * Format base unit quantity into readable packaging breakdown.
   * e.g. 50 bottles -> "2 Cartons, 2 Bottles" (if 1 Carton = 24 Bottles).
   */
  async formatBaseUnits(productId: string, baseQuantity: number): Promise<string> {
    const product = await productRepository.getById(productId);
    if (!product) return `${baseQuantity}`;

    const levels = await productPackagingRepository.getPackagingForProduct(productId);
    if (levels.length === 0) {
      return `${baseQuantity} ${product.baseUnit}`;
    }

    // Sort descending by unitsPerPackage to consume largest packages first
    const sortedLevels = [...levels].sort((a, b) => b.unitsPerPackage - a.unitsPerPackage);

    let remaining = baseQuantity;
    const parts: string[] = [];

    for (const lvl of sortedLevels) {
      if (remaining >= lvl.unitsPerPackage) {
        const count = Math.floor(remaining / lvl.unitsPerPackage);
        remaining = remaining % lvl.unitsPerPackage;
        parts.push(`${count} ${lvl.label}${count > 1 ? "s" : ""}`);
      }
    }

    if (remaining > 0 || parts.length === 0) {
      parts.push(`${remaining} ${product.baseUnit}${remaining > 1 ? "s" : ""}`);
    }

    return parts.join(", ");
  }
}

export const inventoryConversionService = new InventoryConversionService();
