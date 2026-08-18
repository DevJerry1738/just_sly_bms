# QA Test Case 03: Wholesale Catalog & Price Isolation

## Objective
Verify that the wholesale catalogue displays wholesale prices only and hides supply/cost prices.

## Test Steps
1. Log in to customer portal at `/portal/shop`.
2. Inspect product cards.
3. Compare displayed prices with admin product setup (`retailPrice`, `wholesalePrice`, `costPrice`).

## Expected Results
- Catalog displays `wholesalePrice` ONLY.
- `costPrice` and `retailPrice` are never exposed in DOM or portal API payloads.
- Zero-stock HQ items are clearly labeled "Out of stock".
