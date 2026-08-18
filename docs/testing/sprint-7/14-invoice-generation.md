# QA Test Case 14: Invoice Generation

## Objective
Verify admin invoice generation for wholesale orders.

## Test Steps
1. In admin desk `/wholesale-orders`, open order in `payment_confirmed` or later status.
2. Click "Generate Invoice".
3. Check `db.invoices`.

## Expected Results
- `InvoiceSchema` created with auto-numbered `INV-xxxxxx`.
- Invoice linked to `orderId` and `customerId`.
- `due_date` populated (7-day terms).
