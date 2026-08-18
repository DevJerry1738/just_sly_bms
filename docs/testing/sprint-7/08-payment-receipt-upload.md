# QA Test Case 08: Payment Receipt Upload

## Objective
Verify payment receipt upload flow by wholesale customer.

## Test Steps
1. Navigate to `/portal/orders`.
2. Expand pending order and click "Upload Receipt".
3. Provide Bank Name, Transfer Ref, and select a PDF/image receipt file.
4. Click "Submit Receipt".

## Expected Results
- Receipt file stored in Supabase storage bucket (`payment-receipts`).
- Metadata recorded in `PaymentReceiptSchema` and `OrderPaymentSchema`.
- Order status updated to `payment_submitted`.
- Admin desk shows "Payment Submitted" badge.
