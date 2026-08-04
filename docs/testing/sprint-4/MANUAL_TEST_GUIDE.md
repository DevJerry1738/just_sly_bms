# Sprint 4 Manual End-to-End Testing Guide

## 1. Overview
Follow this step-by-step guide to verify all Sprint 4 features in your local browser (`http://localhost:8080/inventory`).

---

## 2. Test Execution Steps

### Step 1: Open Inventory Module
1. Navigate to `http://localhost:8080/inventory`.
2. Confirm the header shows **Inventory Management** and the branch dropdown selector.
3. Observe the 7 sub-tabs: **Dashboard**, **Current Stock**, **Ledger History**, **Batches**, **Expiry Report**, **Stock Count**, **Alerts**.

### Step 2: Record Opening Stock
1. Click **+ Opening Stock** in the top right.
2. Select a product (e.g. `Coca-Cola 35cl`).
3. Enter Quantity `10`, select Packaging Unit `Carton (24 Base Units)`.
4. Enter Unit Cost `₦5,000`.
5. Enter Expiry Date (if applicable).
6. Click **Save Opening Stock**.
7. Confirm:
   - **Current Stock** tab updates to show `240 Pieces`.
   - **Ledger History** tab shows a new `opening_stock` entry with `+240` quantity.

### Step 3: Record a Stock Adjustment
1. Click **Stock Adjustment**.
2. Select `Coca-Cola 35cl`.
3. Select **− Stock Deduction**, enter Quantity `10 Pieces`.
4. Select Reason `Damaged Goods`.
5. Enter Notes: `Glass bottle broke in transit`.
6. Click **Submit Adjustment**.
7. Confirm **Current Stock** drops to `230 Pieces` and **Ledger History** records a `-10` adjustment.

### Step 4: Perform a Stock Count (Stock Take)
1. Switch to the **Stock Count** tab.
2. Click **+ Start New Stock Count**.
3. Click **View Sheet** to open the session count sheet.
4. Locate `Coca-Cola 35cl` (System Qty: 230).
5. Enter Physical Count `225` and click the save icon.
6. Click **Approve & Reconcile** and confirm the dialog.
7. Switch to **Ledger History** — confirm a `stock_count` transaction of `-5` was recorded automatically.

### Step 5: Check Alerts & Expiry Report
1. Switch to the **Alerts** tab.
2. Click **Refresh Scan**.
3. Confirm any low stock or expiring batch alerts are displayed.
4. Click **Acknowledge** on an alert — confirm it clears from the active list.
