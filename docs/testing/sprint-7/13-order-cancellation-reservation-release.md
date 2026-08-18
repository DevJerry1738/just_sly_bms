# QA Test Case 13: Order Cancellation & Reservation Release

## Objective
Verify cancelling an order releases any active stock reservations.

## Test Steps
1. Create order and confirm payment (stock reserved).
2. Admin clicks "Cancel Order" with reason "Customer requested cancellation".

## Expected Results
- Order status changes to `cancelled`.
- Linked stock reservations at HQ released.
- HQ available quantity restored.
