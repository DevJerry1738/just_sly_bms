# QA Test Case 10: Payment Rejection Flow

## Objective
Verify admin payment rejection returns order to pending payment status.

## Test Steps
1. In admin desk `/wholesale-orders`, open order in `payment_submitted` status.
2. Click "Reject Payment" and enter reason "Unclear bank receipt image".
3. Submit rejection.

## Expected Results
- Order returns to `pending_payment` status.
- Rejection reason recorded in order status history.
- Customer sees rejection notice in `/portal/orders` with CTA to re-upload.
