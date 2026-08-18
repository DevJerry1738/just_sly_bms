# QA Test Case 06: No-Credit Purchase Enforcement

## Objective
Verify that wholesale orders cannot proceed to processing or dispatch without payment confirmation.

## Test Steps
1. Place order as wholesale customer.
2. In admin desk `/wholesale-orders`, attempt to advance order status directly from `pending_payment` to `processing`.

## Expected Results
- System blocks status transition.
- Order status remains `pending_payment`.
- Message requires payment receipt upload and admin payment confirmation.
