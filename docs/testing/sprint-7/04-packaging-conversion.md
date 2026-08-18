# QA Test Case 04: Packaging Unit Conversion

## Objective
Verify multi-level packaging conversion when placing wholesale orders.

## Test Steps
1. In `/portal/shop`, select product with packaging rules (e.g. 1 Carton = 24 Bottles).
2. Select "Carton" as selling unit and quantity = 5.
3. Add to cart and place order.

## Expected Results
- Order line item records `sellingUnit = "Carton"`, `quantity = 5`, `unitsPerPackage = 24`.
- Calculated `baseQuantity = 120` (5 × 24).
- Subtotal equals `unitWholesalePrice × 5`.
