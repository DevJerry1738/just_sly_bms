# Sprint 1 — Authentication & Organization Management Manual Test Guide

This document outlines the step-by-step procedures for manually testing and verifying all features implemented in **Sprint 1: Authentication & Organization Management**.

---

## Prerequisites & Environment Setup

1. **Development Server**: Start the local app with `npm run dev`.
2. **Browser Tools**: Open Chrome DevTools (`F12` or `Ctrl + Shift + I`).
3. **Storage Access**: Open **Application > Storage > IndexedDB > JustSlySuiteDB**.

---

## Test Suite 1: Authentication (`Epic 1`)

### Test Case 1.1: Online Login & Route Protection
- **Objective**: Verify authenticated routes redirect unauthenticated users to `/auth`.
- **Steps**:
  1. Open a new Incognito browser window.
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
