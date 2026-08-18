# QA Test Case 07: Order Creation (Pending Payment)

## Objective
Verify order creation flow in `pending_payment` status.

## Test Steps
1. Add items to cart in `/portal/shop`.
2. Enter order notes and click "Place Order".

## Expected Results
- Order created with status `pending_payment`.
- Payment status set to `unpaid`.
- Order status history entry created.
- User redirected to `/portal/orders`.
