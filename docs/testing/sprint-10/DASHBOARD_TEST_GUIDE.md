# Dashboard Quality & Manual Testing Guide — Admin vs. Staff UI/UX Upgrade

This guide details step-by-step test verification procedures for the role-differentiated Admin and Staff Dashboard experiences in the Just Sly Business Suite.

---

## 1. Admin Dashboard Test Suite

### Test 1.1: Admin Multi-Branch Aggregation ("All Branches")
1. Log in as an Administrator (`admin` role).
2. Open the Dashboard (`/`).
3. Confirm top bar displays **All Branches** in the branch switcher.
4. Verify overall enterprise KPIs render:
   - Today's Revenue (sum of all branch sales)
   - Today's Sales Count
   - Wholesale Orders count
   - Low Stock Count across all branches
5. Verify the **Branch Performance Summary Table** lists all registered branches with their respective sales count, total revenue, stock units, and low-stock indicators.

### Test 1.2: Admin Branch Filtering
1. On the Admin Dashboard, click the branch selector and select a specific branch (e.g. `Branch A`).
2. Verify:
   - Active branch updates to `Branch A`.
   - Today's Revenue and Sales Count re-calculate specifically for `Branch A`.
   - "Needs Your Attention" feed filters to `Branch A` alerts.
3. Switch back to **All Branches** -> Confirm global aggregation returns.

### Test 1.3: "Needs Your Attention" Feed & Quick Actions
1. Confirm actionable alert cards appear for:
   - Low stock products
   - Pending branch supplies
   - Pending branch transfers
   - Wholesale orders awaiting payment
2. Click **View Inventory →** on a low stock alert -> confirm navigation to `/inventory`.
3. Test Quick Actions buttons (`Add Product`, `Add Staff`, `Create Branch`, `Supply Branch`) -> verify they open the expected management forms/routes.

---

## 2. Staff Dashboard Test Suite

### Test 2.1: Staff Active Branch Resolution & Data Scoping
1. Log in as a Staff user (e.g., `sales_staff` assigned to `Wuse Branch`).
2. Open the Dashboard (`/`).
3. Verify:
   - Page header displays: `Active Location: Wuse Branch`.
   - Metrics display ONLY `Wuse Branch` sales and inventory.
   - **Cost prices, company-wide profit, and other branches' financial totals ARE STRICTLY HIDDEN.**

### Test 2.2: Staff Primary POS Action
1. Verify the **START A NEW RETAIL SALE** prominent card renders.
2. Click **Open POS Terminal**.
3. Confirm seamless 1-click navigation directly to `/pos`.

### Test 2.3: Staff Incoming Supplies & Transfer Handling
1. Dispatches a supply from HQ to `Wuse Branch`.
2. As `sales_staff` on Wuse Branch Dashboard, verify the **Incoming Stock Supplies from HQ** section lists the pending shipment.
3. Click **Review & Confirm →** -> verify receipt review dialog opens.

### Test 2.4: Staff Receipt Reprinting
1. On Staff Dashboard under **Recent Branch POS Sales**, find a transaction.
2. Click **Reprint**.
3. Confirm the receipt preview modal opens with `*** REPRINT ***` footer and thermal/A4 layout according to organization settings.

---

## 3. Security & Permission Test Suite

1. **Direct Route Protection**: Log in as Staff and attempt to navigate to `/audit-logs` or `/settings` -> confirm **Access Denied** guard screen blocks unauthorized access.
2. **Cost Price Concealment**: Inspect all DOM nodes on Staff Dashboard -> verify no `costPrice` or margin data is passed or rendered in Staff view.
