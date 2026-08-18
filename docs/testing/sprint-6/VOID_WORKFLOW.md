# Void Sale & Inventory Reversal Verification

## Overview
Voiding a completed sale requires atomicity: marking the sale as voided, recording a `sale_voids` entry, and adding a positive inventory transaction (`customer_return`) to restore stock balances in IndexedDB.

---

## Test Steps

### Step 1: Record Baseline Inventory Balance
- Note current stock level for Product A (e.g., Balance = 100 units).

### Step 2: Complete POS Sale
- Sell 5 units of Product A.
- Verify stock balance decreases to **95 units**.
- Sale record `STATUS = "completed"`.

### Step 3: Open Sales History & Select Sale
- Navigate to `/sales` (Sales History).
- Click on the newly completed sale. `SaleDetailModal` opens.

### Step 4: Execute Void Workflow
- Click **Void Sale** button.
- Input reason: `"Customer changed mind"`.
- Click **Confirm Void Sale**.

### Step 5: Verification Checklist
- [ ] Sale status badge changes to `VOIDED` (red).
- [ ] `sale_voids` record created with reason, timestamp, and `inventoryReversed = true`.
- [ ] Product A inventory balance restored to **100 units** (`customer_return` transaction logged).
- [ ] `SALE_VOIDED` event logged in Audit Log.
- [ ] Sync queue contains mutation items for `sales` (UPDATE) and `sale_voids` (CREATE).
