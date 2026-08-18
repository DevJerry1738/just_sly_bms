# QA Test Case 12: Dispatch & HQ Stock Deduction

## Objective
Verify that advancing order to `dispatched` deducts HQ inventory and releases reservations.

## Test Steps
1. Advance order in `ready` status to `dispatched`.
2. Inspect `db.inventory_transactions` and `db.inventory_balances` at `hqBranchId`.

## Expected Results
- `wholesale_dispatch` transaction created for negative quantity at HQ.
- HQ `quantityOnHand` decreased by order base quantity.
- Inventory reservation released (`releasedAt` timestamp populated).
