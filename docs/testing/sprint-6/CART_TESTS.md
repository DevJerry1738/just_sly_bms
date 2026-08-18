# Cart & Packaging Level Test Matrix

## Test Scenarios

### TC-CART-01: Add Item to Cart
- **Precondition**: Product has stock > 0 in active branch.
- **Action**: Click product card in `ProductGrid`.
- **Expected Result**: Item appears in `CartPane` with default `quantity = 1`, packaging = Base Unit, unit price = base retail price.

### TC-CART-02: Manual Quantity Input
- **Action**: Enter `5` directly in quantity input field.
- **Expected Result**: Subtotal recalculates to `5 * unitPrice`. Cart total updates immediately.

### TC-CART-03: Multi-Level Packaging Unit Switch
- **Precondition**: Product configured with "Pack (10 Pieces)" at ₦5,000 (Base Piece ₦500).
- **Action**: Select "Pack" from the unit dropdown in `CartPane`.
- **Expected Result**:
  - Unit price updates to ₦5,000.
  - Base quantity calculation converts 1 Pack to 10 base units for inventory check.
  - Subtotal recalculates correctly.

### TC-CART-04: Exceeding Available Stock
- **Precondition**: Stock balance = 15 pieces. Item in cart has 2 Packs (20 base pieces).
- **Action**: Attempt to increase quantity to 2 Packs.
- **Expected Result**: Validation fails with toast error: `"Insufficient stock balance"`. Quantity reverts to maximum allowed.

### TC-CART-05: Remove Item from Cart
- **Action**: Click trash icon or decrement quantity to 0.
- **Expected Result**: Item removed from cart array. Cart total updates.
