# Sprint 1 — Authentication & Organization Management Manual Test Guide

This document outlines the step-by-step procedures for manually testing and verifying all features implemented in **Sprint 1: Authentication & Organization Management**.

---

## Prerequisites & Environment Setup

1. **Development Server**: Start the local app with `npm run dev`.
2. **Browser Tools**: Open Chrome DevTools (`F12` or `Ctrl + Shift + I`).
3. **Storage Access**: Open **Application > Storage > IndexedDB > JustSlySuiteDB**.

## Clean-Slate Demo Reset

Use this before recording a setup-from-scratch demo. It preserves the administrator login but removes business data. Run it only against the dedicated demo Supabase project.

### 1. Clear business data in Supabase

Run this in the Supabase SQL Editor. The existence check is intentional because some deployments do not contain every optional table.

```sql
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'user_permission_overrides', 'notifications', 'audit_logs',
    'payment_receipts', 'invoices', 'order_payments', 'order_status_history',
    'wholesale_order_items', 'wholesale_orders', 'sale_voids', 'sale_payments',
    'sale_items', 'sales_normalized', 'customer_accounts', 'customers',
    'sales', 'orders', 'inventory_balances', 'inventory_transactions',
    'inventory_adjustments', 'inventory_alerts', 'stock_count_items',
    'stock_count_sessions', 'inventory_batches', 'inventory_reservations',
    'inventory_transfer_batches', 'inventory_transfer_items',
    'inventory_transfers', 'transfer_status_history', 'inventory',
    'product_packaging', 'products', 'categories', 'units_of_measure',
    'staff', 'branches', 'organizations', 'user_preferences'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = target_table
    ) THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', target_table);
    END IF;
  END LOOP;
END $$;
```

Do not truncate `auth.users` or `profiles`; the preserved administrator must remain able to sign in. Verify that the administrator still has an `admin` row in `public.user_roles`.

### 2. Clear this browser

In the app's browser console, run:

```js
await navigator.serviceWorker.getRegistrations().then((registrations) =>
  Promise.all(registrations.map((registration) => registration.unregister()))
);
await caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
localStorage.clear();
sessionStorage.clear();
await new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase("JustSlySuiteDB");
  request.onsuccess = resolve;
  request.onerror = () => reject(request.error);
  request.onblocked = resolve;
});
location.reload();
```

### 3. Expected clean state

After signing in again, the administrator should see **Branches** and **Staff** in the navigation. The following should be empty until created manually: organization details, branches, staff, customers, products, sales, wholesale orders, and inventory balances. System permissions, roles, units, and categories may remain available as setup metadata.

---

## Test Suite 1: Authentication (`Epic 1`)

### Test Case 1.1: Online Login & Route Protection
- **Objective**: Verify authenticated routes redirect unauthenticated users to `/auth`.
- **Steps**:
  1. Open a new Incognito browser window.v
  2. Navigate directly to `http://localhost:3000/settings` or `http://localhost:3000/`.
  3. Verify automatic redirect to `/auth`.
  4. Enter valid user credentials and click **Sign in**.
  5. Verify smooth navigation to the Dashboard (`/`).

### Test Case 1.2: Offline Login Interception
- **Objective**: Verify auth attempts are gracefully blocked when offline without unhandled network errors.
- **Steps**:
  1. On the `/auth` page, open DevTools -> **Network** tab -> Check **Offline**.
  2. Enter any email and password, then click **Sign in**.
  3. **Expected Result**: A toast error appears stating: `"Authentication unavailable offline. Please check your internet connection."`
  4. Uncheck **Offline** to restore connectivity.

### Test Case 1.3: Forgot Password Recovery
- **Objective**: Verify password reset requests trigger email recovery links.
- **Steps**:
  1. On `/auth` page (Sign in tab), click **Forgot password?**.
  2. Verify the **Reset Password** modal appears.
  3. Enter `admin@justsly.com` and click **Send Reset Link**.
  4. Verify success toast and confirmation view inside the dialog.

### Test Case 1.4: Multi-Tab Session Synchronization
- **Objective**: Verify auth state stays perfectly in sync across browser tabs.
- **Steps**:
  1. Open Tab A and Tab B to `http://localhost:3000/`.
  2. On Tab A, click user avatar -> **Sign out**.
  3. **Expected Result**: Tab A and Tab B immediately invalidate sessions and redirect to `/auth`.

---

## Test Suite 2: Organization Management (`Epic 2`)

### Test Case 2.1: General Settings Update & Offline Queueing
- **Objective**: Verify organization general settings persist locally to IndexedDB and queue mutation.
- **Steps**:
  1. Navigate to **Settings** (`/settings`) -> **General** tab.
  2. Update **Organization Display Name** to `"Just Sly West Africa Branch"`.
  3. Select **Currency** = `NGN (₦)`, **Timezone** = `WAT`, **Date Format** = `DD/MM/YYYY`.
  4. Click **Save Changes**.
  5. Open DevTools -> **Application > IndexedDB > JustSlySuiteDB > organizations**.
  6. **Expected Result**: Record `default-org-001` shows updated name `"Just Sly West Africa Branch"` with `sync_status = "pending"`.
  7. Check **syncQueue** store: a new item with `entityType: "organizations"`, `operationType: "UPSERT"` exists.

### Test Case 2.2: Company Profile & Tax Identifiers
- **Objective**: Verify corporate registration and TIN save accurately.
- **Steps**:
  1. Go to **Company Profile** tab.
  2. Enter:
     - **Legal Name**: `Just Sly Business Solutions Nigeria Ltd`
     - **Reg No**: `CS-9840210`
     - **Tax ID / TIN**: `TIN-1092840-GH`
  3. Click **Save Changes**.
  4. Refresh page (`F5`) to verify data persists across browser reloads.

### Test Case 2.3: Branding & Logo Variant Selection
- **Objective**: Verify branding logo selection and hex primary color update.
- **Steps**:
  1. Go to **Branding** tab.
  2. Select **Dark Dark Mode Shield** logo variant.
  3. Enter hex color `#1e293b`.
  4. Click **Save Changes**.
  5. Verify selected logo variant stays highlighted upon reload.

### Test Case 2.4: Thermal Receipt Live Preview & Customization
- **Objective**: Verify thermal receipt message changes update live preview in real time.
- **Steps**:
  1. Go to **Receipt Templates** tab.
  2. Modify **Receipt Header Message** to `"Welcome to Just Sly Flagship Store"`.
  3. Observe **Thermal Receipt Preview** card on the right.
  4. **Expected Result**: The receipt preview text immediately reflects `"Welcome to Just Sly Flagship Store"`.
  5. Toggle **Include Organization Logo** switch off -> verify logo disappears from preview.
  6. Click **Save Changes**.

---

## Summary
All features in Sprint 1 strictly adhere to:
- **Repository Pattern**: `OrganizationRepository` extending `BaseRepository<OrganizationSchema>`.
- **Offline-First Infrastructure**: Local IndexedDB reads/writes with background `SyncQueue` mutations.
- **Design Tokens**: Standard typography (`Inter`), semantic OKLCH color variables, and Shadcn UI primitives.

---

## Test Suite 3: Cross-Browser Staff Permission Synchronization

### Test Case 3.1: Remote Permission Persistence
- **Objective**: Verify a permission override is persisted in Supabase and displayed consistently across browsers.
- **Prerequisites**: Deploy the current build. Use two separate browsers and an admin account that can manage staff permissions.
- **Steps**:
  1. Open DevTools -> **Application -> IndexedDB -> JustSlySuiteDB** in both browsers.
  2. In Browser A, log in as an admin and open **Staff -> Jane Doe -> Individual Permissions**.
  3. Set **Point of Sale (POS)** to **Denied** and confirm the change.
  4. Verify the modal shows one explicit deny and the staff table shows one custom override.
  5. Inspect the `syncQueue` store and confirm a `user_permission_overrides` `UPSERT` is pending briefly and then removed after successful synchronization.
  6. In Supabase SQL Editor, run:
     ```sql
     SELECT user_id, permission_id, effect, updated_at
     FROM public.user_permission_overrides
     ORDER BY updated_at DESC;
     ```
  7. Verify exactly one canonical row exists for the affected staff member, with the expected POS permission and `DENY` effect.
  8. In Browser B, hard refresh and open `/users`.
  9. Verify the staff table shows one custom override and the modal shows the same denied POS permission.
  10. Log in as the affected staff user in both browsers and verify POS is inaccessible.
- **Expected Result**: The table, modal, Supabase, and both staff sessions show the same restriction.

### Test Case 3.2: Recovery of a Failed Permission Queue Item
- **Objective**: Verify a permission item created by an older deployment can be recovered without retrying unrelated queue failures.
- **Steps**:
  1. Deploy the current build before clearing browser storage.
  2. Hard refresh both browsers so the current sync handler bundle is loaded.
  3. Open the `JustSlySuiteDB` `syncQueue` store and record failed `user_permission_overrides` payloads.
  4. Visit `/users` or use the application sync control to trigger synchronization.
  5. Confirm the permission item is no longer failed and is removed after a successful upload.
  6. Confirm unrelated failed queue records were not automatically requeued by this recovery.
  7. Verify the corresponding Supabase row.
- **Expected Result**: Only permission overrides with the known missing-handler error are retried; successful records are removed from the queue.

### Test Case 3.3: Safe Browser Cache Reset
- **Objective**: Rehydrate a browser from the remote source after successful permission recovery.
- **Steps**:
  1. Capture or successfully upload all permission queue payloads first.
  2. Unregister the service worker and clear Cache Storage only if an old deployment is still served.
  3. Reload the application.
  4. Use `await indexedDB.deleteDatabase("JustSlySuiteDB")` only after the remote row is confirmed in Supabase.
  5. Log in again and repeat Test Case 3.1.
- **Expected Result**: The restriction is rehydrated from Supabase and remains identical across browsers.

---

## End-to-End Production Validation: Sales + Permission Sync Recovery

### Test Case 4.1: Confirm stale runtime is cleared and the queue is retried
- **Objective**: Verify the browser is no longer serving a stale client bundle and the sync queue can recover after deployment.
- **Steps**:
  1. Deploy the latest build and reload the app in a fresh browser session.
  2. Open DevTools → Application → IndexedDB → JustSlySuiteDB → syncQueue.
  3. Confirm the stale-data banner is no longer present.
  4. If a `sale_items` or `user_permission_overrides` item is still failed with "No sync handler registered", trigger a manual sync from the UI or reload the page while online.
  5. Observe the queue status change from `failed` to `pending` and then disappear after successful upload.
- **Expected Result**: The stale-runtime queue entries recover cleanly and the browser is no longer stuck with the old bundle.

### Test Case 4.2: Verify sales sync end-to-end across two PCs
- **Objective**: Confirm a sale created on one machine appears in Supabase and in a second browser session.
- **Steps**:
  1. On PC A, log in as an admin and complete a POS sale.
  2. Wait for the queue item to clear or trigger manual sync.
  3. In Supabase SQL editor, run:
     ```sql
     SELECT *
     FROM public.sales_normalized
     ORDER BY created_at DESC;
     ```
  4. Also check:
     ```sql
     SELECT *
     FROM public.sale_items
     ORDER BY created_at DESC;
     ```
  5. On PC B, log in as the same admin and open `/sales`.
  6. Refresh the page and confirm the sale appears.
- **Expected Result**: The sale and sale items are present in Supabase and visible on both machines.

### Test Case 4.3: Verify permission override sync end-to-end across two PCs
- **Objective**: Confirm a staff permission override is pushed to Supabase and visible by a fresh browser.
- **Steps**:
  1. On PC A, log in as admin and change one permission for a staff user.
  2. Wait for the queue item to clear or trigger sync.
  3. In Supabase SQL editor, run:
     ```sql
     SELECT user_id, permission_id, effect, updated_at
     FROM public.user_permission_overrides
     ORDER BY updated_at DESC;
     ```
  4. On PC B, log in as the same admin and open `/users`.
  5. Verify the custom override badge and permission restriction match the same user state.
- **Expected Result**: The override is present in Supabase and matches across browsers.

### Test Case 4.4: Safe reset after successful recovery
- **Objective**: Clear stale local browser state without losing the source-of-truth records.
- **Steps**:
  1. Confirm the remote Supabase rows exist for both sales and permission overrides.
  2. Only then clear IndexedDB if a browser is still stale.
  3. Log in again and confirm the app rehydrates from Supabase, not from stale local cache.
- **Expected Result**: Local browser cache is rebuilt cleanly from Supabase and remains in sync.

---

## Final success criteria

The fix is complete only when all of the following are true:
- the stale-data banner is no longer active after a valid deployment
- no `sale_items` queue entries fail with "No sync handler registered"
- new sales appear in Supabase within the same session
- permission overrides appear in `public.user_permission_overrides`
- a fresh browser sees the same sales and restriction state as the original admin browser
- the queue is empty or only contains genuine non-failing items after successful sync

## End-to-End Wholesale Sync Recovery

### Test Case 5.1: Parent and child queue ordering
- **Objective**: Verify a wholesale order and all dependent records upload in dependency order.
- **Steps**:
  1. Use Browser A while online and create a wholesale order with at least one item.
  2. Inspect `JustSlySuiteDB.syncQueue` and note the order ID on the order, item, and status-history payloads.
  3. Trigger sync and confirm the `wholesale_orders` item completes before its dependent items.
  4. In Supabase, verify rows exist in `wholesale_orders`, `wholesale_order_items`, and `order_status_history`.
- **Expected Result**: The child records are not skipped after the parent is removed from the queue.

### Test Case 5.2: Failed parent recovery
- **Objective**: Verify a failed wholesale parent blocks children and scoped recovery retries the family.
- **Steps**:
  1. Temporarily use an invalid parent reference or an unapplied schema migration to produce a failed `wholesale_orders` queue item.
  2. Trigger sync and confirm dependent child items remain blocked or become failed with a dependency error.
  3. Correct the remote prerequisite or apply `20260914120000_extend_wholesale_sync_columns.sql`.
  4. Trigger recovery while online.
  5. Confirm the parent uploads first, then items, history, payments, receipts, and invoices upload.
  6. Confirm unrelated failed entity types were not requeued by the scoped sync trigger.
- **Expected Result**: Local records remain available until successful upload, and the wholesale family reaches a synced state.

### Test Case 5.3: Cross-browser wholesale pull
- **Objective**: Verify normalized wholesale data rehydrates a fresh browser.
- **Steps**:
  1. In Browser A, submit a payment receipt and generate an invoice for a synced order.
  2. Verify Supabase rows and fields in `order_payments`, `payment_receipts`, and `invoices`.
  3. Open Browser B with a fresh profile against the same Supabase project.
  4. Sign in and trigger pull-sync, then inspect the wholesale tables in IndexedDB.
- **Expected Result**: Browser B contains the order, items, status history, payment metadata, receipt metadata, and invoice data.

## Mobile Responsive Validation

### Test Case 6.1: Viewport and shell checks
- **Objective**: Verify the shared shell remains usable on phone and tablet widths.
- **Viewports**: 320x568, 375x667, 390x844, and 768x1024.
- **Steps**:
  1. Open the app in Chrome DevTools device emulation at each viewport.
  2. Confirm there is no page-level horizontal scrollbar or clipped heading.
  3. Open and close the navigation drawer, then navigate to another route.
  4. Confirm the drawer closes, focus returns to the menu button, and the active route is visible.
  5. Verify sync status, notifications, and account controls remain reachable from the phone top bar.
- **Expected Result**: Content respects the safe area, the shell fits the viewport, and all primary navigation remains reachable.

### Test Case 6.2: POS and wholesale touch workflows
- **Objective**: Verify high-frequency transaction flows work with touch and a virtual keyboard.
- **Steps**:
  1. On a 375px viewport, search products and add multiple items to the POS cart.
  2. Adjust quantity, change packaging, open checkout, and complete or cancel the dialog.
  3. Open wholesale orders, filter status, search by order number, and open order details.
  4. In the portal, open the shop, add an item, review orders, and open receipt upload.
  5. Confirm dialogs scroll internally and their actions remain visible above the safe-area/keyboard region.
- **Expected Result**: Inputs do not zoom unexpectedly, buttons are easy to tap, and no workflow requires desktop-only hover or precision scrolling.

### Test Case 6.3: Responsive data and offline behavior
- **Objective**: Verify dense data views and offline feedback remain usable on small screens.
- **Steps**:
  1. Open customers, products, sales, inventory, users, audit logs, and reports at 320px and 390px widths.
  2. Confirm table scrolling is contained inside the table region and does not widen the page.
  3. Toggle the browser offline, create a POS or wholesale mutation, and inspect the sync status control.
  4. Reconnect and trigger sync from the mobile control.
  5. Repeat with dark theme and reduced-motion enabled.
- **Expected Result**: Primary fields and actions remain visible, queue status is understandable, and the page does not shift or clip during sync.
