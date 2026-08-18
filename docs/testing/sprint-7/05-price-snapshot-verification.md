# QA Test Case 05: Price Snapshot Verification

## Objective
Verify that line item prices are snapshotted at order creation time so subsequent price updates do not change historical order totals.

## Test Steps
1. Customer creates wholesale order for Product X at ₦10,000 unit price.
2. Admin edits Product X wholesale price to ₦12,000 in Product Management.
3. Reload `/portal/orders` and admin `/wholesale-orders`.

## Expected Results
- Order line item retains `unitPriceSnapshot = 10000` and original subtotal.
- Historical order total remains unchanged.
