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

### TC-BATCH-04: Expiry Notification Deduplication
1. Add one active batch whose expiry date has passed.
2. Open the dashboard and notifications page in two browser tabs.
3. Allow both pages to perform their initial notification refresh and scanner run.
4. Confirm exactly one `expired` inventory alert and one corresponding notification exist for the batch.
5. Mark the notification as read.
6. Wait for at least one polling interval and refresh both tabs.
7. Confirm the notification remains read and no new notification row is created.

### TC-BATCH-05: Threshold Transition Notification
1. Add a batch expiring in 7 days and run the alert scan.
2. Confirm exactly one `expiring_7d` alert and notification are generated.
3. Change the batch expiry date so it is expired and run the alert scan again.
4. Confirm exactly one new `expired` alert and notification are generated.
5. Run the scan repeatedly and confirm neither threshold creates another notification.

### TC-BATCH-06: Branch Isolation For Expiry Notifications
1. Create equivalent batch numbers for the same product in two branches.
2. Run the expiry scan while Branch A is active.
3. Confirm Branch A shows only its own expiry notification.
4. Switch to Branch B and confirm Branch B shows only its own expiry notification.
5. Mark Branch B's notification as read and confirm Branch A's notification is unchanged.
