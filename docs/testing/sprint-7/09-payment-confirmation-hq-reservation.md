# QA Test Case 09: Payment Confirmation & HQ Stock Reservation

## Objective
Verify admin payment confirmation creates HQ stock reservations.

## Test Steps
1. Log in as admin at `/wholesale-orders`.
2. Open order with status `payment_submitted`.
3. Click "Confirm Payment".
4. Check `db.inventory_reservations` in IndexedDB.

## Expected Results
- Order status updates to `payment_confirmed`.
- Inventory reservation record created for each line item at `hqBranchId`.
- HQ available quantity reduced by reserved quantity.
- Stock on hand is NOT deducted yet.
