# Low Stock Monitoring Test Plan

## Objective
Verify stock status badges and alert generation against product lowStockThreshold values.

## Test Cases

### TC-LOW-01: Low Stock State Transition
1. Set product `lowStockThreshold` to 20.
2. Record opening stock of 50 → Status: `In Stock`.
3. Perform a deduction adjustment of −35 (qty becomes 15).
4. Verify status badge changes to `Low Stock` (amber warning).

### TC-LOW-02: Out of Stock State Transition
1. Perform a deduction adjustment of −15 (qty becomes 0).
2. Verify status badge changes to `Out of Stock` (red badge).
3. Confirm an alert of type `out_of_stock` is created.
