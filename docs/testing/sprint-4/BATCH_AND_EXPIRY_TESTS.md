# Batch & Expiry Test Plan

## Objective
Verify product batch creation, FIFO deduction order, and 7/30/60/90-day expiry alert evaluations.

## Test Cases

### TC-BATCH-01: Batch Creation on Expiry Products
1. Select a product with `trackExpiry = true`.
2. Record opening stock with Expiry Date set to 15 days in the future.
3. Confirm a row is written to `inventory_batches` with `status = active` and a generated `BAT-YYYYMMDD-XXXX` number.

### TC-BATCH-02: FIFO Expiry Allocation
1. Create Batch A expiring in 10 days (qty 50).
2. Create Batch B expiring in 30 days (qty 50).
3. Execute a FIFO deduction of 60 units.
4. Confirm Batch A is fully depleted (qty 0, `status = depleted`).
5. Confirm Batch B has 40 units remaining.

### TC-BATCH-03: Expiry Alert Timeline Scanning
1. Add a batch expiring in 5 days.
2. Run `inventoryAlertService.runAlertScan()`.
3. Confirm an alert of type `expiring_7d` and severity `critical` is generated and mirrored in notifications.
