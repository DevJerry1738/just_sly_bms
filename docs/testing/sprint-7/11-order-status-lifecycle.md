# QA Test Case 11: Full Order Status Lifecycle

## Objective
Verify sequential status transitions: `pending_payment` → `payment_submitted` → `payment_confirmed` → `processing` → `ready` → `dispatched` → `delivered`.

## Test Steps
1. Advance order through each stage in admin desk.
2. Verify invalid out-of-sequence transitions are blocked.

## Expected Results
- Each valid transition updates status and appends audit history.
- Invalid state jumps (e.g. `pending_payment` → `dispatched`) throw controlled errors.
