# Sprint 10 QA & Manual Testing Guide — Audit & System Settings

This document provides step-by-step test procedures for verifying **Epic 21 (Audit Logs)** and **Epic 22 (System Settings)** in the Just Sly Business Suite.

---

## 1. Audit Log Verification Scenarios

### Test 1.1: Authentication Audit Events (Login & Logout)
1. Navigate to `/auth` and log in with valid credentials.
2. Navigate to `/audit-logs`.
3. Verify an event named `LOGIN_SUCCESS` appears with:
   - Module: `Authentication`
   - Actor: Your user email
   - Description detailing successful authentication.
4. Log out of the application.
5. Log back in and navigate to `/audit-logs`.
6. Verify a `LOGOUT` event is present for the previous session.

### Test 1.2: Failed Login Capture
1. Navigate to `/auth` and attempt to log in with an incorrect password.
2. Log in with correct credentials.
3. Open `/audit-logs`.
4. Verify a `LOGIN_FAILED` event is present recording the attempt and reason.

### Test 1.3: Product CRUD Audit Trail
1. Navigate to `/products`.
2. Click **Add Product** and create a new item (e.g. "Test Audit Product").
3. Click **Edit Product** on the item and change Retail Price (e.g. ₦4,500 → ₦5,000).
4. Click **Archive Product**.
5. Navigate to `/audit-logs`.
6. Confirm 3 distinct events: `PRODUCT_CREATED`, `PRODUCT_UPDATED`, and `PRODUCT_ARCHIVED`.
7. Click the **View Eye Icon** on `PRODUCT_UPDATED`:
   - Verify the Change Summary drawer opens.
   - Confirm `retailPrice` shows `4500` in red (Previous) and `5000` in green (New).

### Test 1.4: Inventory Adjustment Audit Trail
1. Navigate to `/inventory` and perform a **Stock Adjustment** (e.g. +10 units for Damaged Goods).
2. Navigate to `/audit-logs`.
3. Verify a `STOCK_ADJUSTED` event appears with:
   - Module: `Inventory`
   - Quantity before and after recorded in detail drawer.

### Test 1.5: Wholesale Order Status Change Audit
1. Navigate to `/wholesale-orders`.
2. Advance an order status or confirm payment.
3. Open `/audit-logs`.
4. Confirm `WHOLESALE_ORDER_CREATED` or `PAYMENT_CONFIRMED` event is logged.

### Test 1.6: Category & Customer CRUD Audit
1. Create or update a customer account in `/customers`.
2. Create or update a category in `/products`.
3. Open `/audit-logs` and filter by Module `Customers` or `Products`.
4. Verify `CUSTOMER_CREATED` / `CUSTOMER_UPDATED` / `CATEGORY_CREATED` / `CATEGORY_UPDATED` entries appear.

---

## 2. Audit Security & Filtering Verification

### Test 2.1: Audit Search & Filters
1. Open `/audit-logs`.
2. Select **Module: Inventory** from the module dropdown.
3. Confirm only inventory-related audit logs are displayed.
4. Type a keyword into the search bar (e.g., "Price").
5. Verify matching records update in real time.

### Test 2.2: Audit CSV Export & Self-Audit
1. Click **Export CSV** button in `/audit-logs`.
2. Confirm CSV file downloads to your device.
3. Open CSV file and verify columns: `Timestamp`, `Date`, `Actor`, `Module`, `Action`, `Entity`, `Description`.
4. Refresh `/audit-logs`.
5. Verify a new audit log `AUDIT_EXPORTED` is created documenting the export event itself.

### Test 2.3: RBAC Access Control & Append-Only Rule
1. Log in as a `sales_staff` account (without `audit_logs:view` permission).
2. Attempt to navigate to `/audit-logs`.
3. Confirm the screen displays **Access Denied** with a security alert.
4. Verify there is **NO Delete Audit Log button** anywhere in the UI (Enforcing append-only architecture).

---

## 3. System Settings Verification

### Test 3.1: Notification Channel Preferences
1. Navigate to `/settings` -> **Notification Channels** tab.
2. Toggle channel switches for **Wholesale Order Status Updates** (In-App, Email, WhatsApp).
3. Click **Save Preferences**.
4. Confirm success toast notification.
5. Open `/audit-logs` -> confirm `NOTIFICATION_SETTINGS_CHANGED` event is logged.

### Test 3.2: Low Stock Default Threshold & Bulk Update Rule
1. Navigate to `/settings` -> **Inventory Defaults** tab.
2. Change Default Low Stock Reorder Threshold from `5` to `10`.
3. Leave "Apply to existing products" **UNCHECKED**. Click **Save Default Threshold**.
4. Navigate to `/products` -> Click **Add Product**. Confirm pre-filled threshold is `10`.
5. Return to `/settings` -> **Inventory Defaults**.
6. Check **"Apply new default threshold (10 units) to ALL existing catalog products"** and click Save.
7. Confirm all existing products now have `lowStockThreshold = 10`.
8. Check `/audit-logs` -> confirm `LOW_STOCK_DEFAULT_CHANGED` event with `appliedToExisting: true`.

### Test 3.3: Email Template Editor & Variable Hints
1. Navigate to `/settings` -> **Email Templates** tab.
2. Click **Edit Template** on "Wholesale Order Confirmed".
3. Click a variable chip (e.g. `{{customer_name}}`) -> verify it inserts into the body text.
4. Edit the subject line and click **Save Template**.
5. Confirm success toast and verify updated date changes.
6. Check `/audit-logs` -> confirm `EMAIL_TEMPLATE_CHANGED` event.

### Test 3.4: Receipt Format & Live Preview
1. Navigate to `/settings` -> **Receipt Templates** tab.
2. Switch format between **Compact Thermal (80mm)** and **Full A4 Invoice**.
3. Verify live preview panel on right dynamically switches between thermal ticket and A4 layout.
4. Edit Header / Footer text -> verify preview updates in real-time.
5. Click **Save Changes**.
6. Check `/audit-logs` -> confirm `RECEIPT_SETTINGS_CHANGED` event.
