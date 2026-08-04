# Ledger Validation & Immutability Test Plan

## Objective
Verify that `inventory_transactions` acts as an immutable source of truth and `inventory_balances` accurately reflects base-unit totals.

## Test Cases

### TC-LEDGER-01: Immutable Ledger Writing
1. Record an **Opening Stock** transaction of 100 base units.
2. Confirm a new row is appended to `inventory_transactions` with a unique reference number (`TXN-YYYYMMDD-XXXX`).
3. Verify that update or delete operations on `inventory_transactions` are rejected or restricted.

### TC-LEDGER-02: Base Unit Packaging Conversion
1. Select a product with base unit `Bottle` and packaging `1 Carton = 24 Bottles`.
2. Record an opening stock entry of **10 Cartons**.
3. Inspect `inventory_transactions`: quantity must equal **+240 Bottles**.
4. Inspect `inventory_balances`: `quantityOnHand` must equal **240**.

### TC-LEDGER-03: Atomic Balance Deltas
1. Record a positive adjustment of +50 Bottles.
2. Verify `quantityOnHand` increases from 240 to 290.
3. Record a negative adjustment of −15 Bottles.
4. Verify `quantityOnHand` decreases from 290 to 275.
