# Granular Staff Permissions & Permission Overrides — End-to-End Testing Guide

This guide details comprehensive testing procedures for verifying the **Granular Staff Permissions / Individual Permission Overrides** feature in the Just Sly Business Suite.

---

## 1. Scenario Matrix & Key Test Cases

### Test Case 1: Individual Grant Override (Critical Requirement)
- **Goal:** Verify Admin can grant a permission to User A without modifying User B's access or changing the shared Sales Staff role.
- **Steps:**
  1. Login as Admin. Navigate to **Staff Directory** (`/users`).
  2. Locate **User A** (Role: `Sales Staff`). Click the **Shield (Manage Permissions)** button.
  3. Locate `inventory:adjust` (*Adjust Inventory Stock*). Notice current state is `Inherited (Denied)`.
  4. Change dropdown from `Inherited` to `Grant`. Provide optional reason: *"Temporary stock count assistant"*. Click **Confirm Change**.
  5. Verify badge for User A on Staff page shows **1 custom override**.
  6. Switch/Test session as User A: Confirm User A can access **Adjust Inventory** button on `/inventory`.
  7. Check **User B** (Same `Sales Staff` role): Verify User B cannot adjust inventory and still sees access restricted.

---

### Test Case 2: Individual Deny Override
- **Goal:** Verify explicit individual `DENY` takes precedence over inherited role permissions.
- **Steps:**
  1. Select a **Branch Manager** staff user (normally inherits `reports:view` and `branches:update`).
  2. Open **Permissions Workspace**.
  3. Change `reports:view` to `Deny`. Click **Confirm Change**.
  4. Verify state badge updates to **Explicitly Denied**.
  5. Test session as Branch Manager user: Verify **Reports & Analytics** menu is hidden from sidebar and direct navigation to `/analytics` results in Access Denied.

---

### Test Case 3: Reset to Role Defaults
- **Goal:** Verify Admin can wipe individual overrides for a user and restore pure role-based permissions.
- **Steps:**
  1. Open Permissions Workspace for a user with custom overrides (e.g. 2 Grants, 1 Deny).
  2. Click **Reset to Role Defaults** button at top right.
  3. Confirm modal warning *"Reset permissions for John Doe?"*. Click **Reset All Overrides**.
  4. Verify all permission rows return to **Inherited from Role** and custom override count badge vanishes from Staff Directory.

---

### Test Case 4: Delegation & Protected Permission Safeguards
- **Goal:** Ensure protected permissions cannot be casually delegated and normal Admins cannot elevate themselves beyond authority.
- **Steps:**
  1. Review protected permissions list (`products:view_cost`, `products:edit_cost`, `staff:permissions`, `settings:manage`).
  2. Log in as a standard Admin (without `products:view_cost`).
  3. Attempt to grant `products:view_cost` to another staff member.
  4. Verify system blocks action with toast error: *"You cannot grant this permission because you do not hold it yourself."* or *"Protected permissions can only be delegated by Super Admin."*

---

### Test Case 5: Bulk Module Controls
- **Goal:** Test `Grant All`, `Revoke All`, and `Reset Module` controls on a module category.
- **Steps:**
  1. Open Permissions Workspace for a staff member.
  2. Under **Products & Pricing** module header, click **Grant All**.
  3. Confirm bulk dialog. Verify all non-protected permissions in the module update to `Explicitly Granted`.
  4. Click **Reset Module** to revert all product permissions to `Inherited`.

---

### Test Case 6: Offline Persistence & Sync Queue
- **Goal:** Verify permission changes persist locally in IndexedDB when offline and sync to Supabase when connection restores.
- **Steps:**
  1. Toggle browser offline mode (Network -> Offline).
  2. Grant a permission override for a staff member.
  3. Verify change updates instantly in UI and records in IndexedDB `user_permission_overrides` table with `sync_status = "pending"`.
  4. Toggle network online.
  5. Trigger Sync / reload page: Verify sync queue pushes upsert payload to Supabase table `user_permission_overrides` and updates `sync_status = "synced"`.

---

## 2. Verification Checklist

| Checkpoint | Requirement | Status |
| :--- | :--- | :---: |
| **RBAC Foundation** | Existing roles (`super_admin`, `branch_manager`, `sales_staff`, `viewer`) remain intact. | PASS |
| **3-State Model** | `DENY` > `GRANT` > `ROLE` > `DEFAULT_DENY` priority strictly enforced. | PASS |
| **Multi-Tenant RLS** | `user_permission_overrides` contains `organization_id` index & compound unique constraint. | PASS |
| **UI Transparency** | Visual badges distinguish `Inherited`, `Explicitly Granted`, `Explicitly Denied`, and `Protected`. | PASS |
| **Audit Log Trail** | `STAFF_PERMISSION_GRANTED`, `STAFF_PERMISSION_REVOKED`, `STAFF_PERMISSION_RESET` events logged. | PASS |
| **Safeguards** | Self-revocation of permission management and unauthorized delegation blocked. | PASS |
