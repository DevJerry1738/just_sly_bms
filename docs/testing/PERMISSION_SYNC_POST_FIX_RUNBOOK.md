# Permission Sync Post-Fix Runbook

This runbook verifies that staff permission overrides persist in Supabase and remain consistent across browsers.

## Scope

Use this runbook for the permission override issue where:

- POS access is correctly denied for the staff user.
- The permissions modal shows the override.
- The `/users` table or another browser does not show the same override.

POS enforcement should remain unchanged. The required proof is remote persistence plus consistent administrative display.

## Before Deployment

1. Confirm the build includes these modules:
   - `src/services/sync/entity-sync-handlers.ts`
   - `src/services/sync/sync-manager.ts`
   - `src/services/sync/sync-queue.ts`
   - `src/services/sync/sync-scheduler.ts`
   - `src/features/users/components/users-page.tsx`
2. Run `npm run build`.
3. Preserve any failed `user_permission_overrides` queue payloads in the affected browsers.
4. Do not delete `JustSlySuiteDB` until those payloads are either uploaded or recorded for manual recovery.

## Supabase Baseline

Run this in the Supabase SQL Editor:

```sql
SELECT
  o.id,
  o.organization_id,
  o.user_id,
  o.permission_id,
  o.effect,
  o.updated_at,
  s.id AS staff_id,
  s.auth_user_id,
  s.email
FROM public.user_permission_overrides o
LEFT JOIN public.staff s
  ON s.id = o.user_id
ORDER BY o.updated_at DESC;
```

For legacy data, check staff-ID aliases:

```sql
SELECT o.id, o.user_id, s.id AS staff_id, s.auth_user_id, o.permission_id
FROM public.user_permission_overrides o
JOIN public.staff s
  ON s.id = o.user_id
WHERE s.auth_user_id IS NOT NULL
  AND o.user_id <> s.auth_user_id::text;
```

The second query should return no rows after reconciliation. Before running a backfill, check for duplicate logical overrides so the unique constraint is not violated.

## Deploy and Refresh

1. Deploy the current build.
2. Open the deployed application in both browsers.
3. If an old service-worker bundle is still served, run this in each browser console:

```js
await navigator.serviceWorker.getRegistrations().then((registrations) =>
  Promise.all(registrations.map((registration) => registration.unregister()))
);
await caches.keys().then((keys) =>
  Promise.all(keys.map((key) => caches.delete(key)))
);
location.reload();
```

4. Do not clear IndexedDB yet. Failed queue entries may contain the only copy of a local permission change.

## Inspect the Correct Local Database

The application database is `JustSlySuiteDB`.

```js
const request = indexedDB.open("JustSlySuiteDB");
request.onsuccess = (event) => {
  const database = event.target.result;
  const transaction = database.transaction("syncQueue", "readonly");
  const readRequest = transaction.objectStore("syncQueue").getAll();
  readRequest.onsuccess = () => {
    console.table(
      readRequest.result
        .filter((item) => item.entityType === "user_permission_overrides")
        .map((item) => ({
          id: item.id,
          status: item.status,
          operation: item.operationType,
          userId: item.payload?.userId,
          permissionId: item.payload?.permissionId,
          error: item.errorMessage,
        }))
    );
  };
};
```

Interpretation:

- `pending`: waiting for upload
- `syncing`: currently uploading
- `failed`: upload failed; inspect `error`
- no row: the mutation completed and was removed, or local data was cleared

## Targeted Recovery

After the current bundle is loaded, visit `/users`, use the application sync control, or wait for the sync scheduler. The application requeues only failed permission items with the known error:

```text
No sync handler registered for entity "user_permission_overrides"
```

It then processes permission overrides before the larger historical queue.

Do not requeue every failed item. Unrelated sales, audit, inventory, and customer failures may have different dependencies and must be handled separately.

## End-to-End Test

Use two separate browsers.

1. Browser A: sign in as an admin.
2. Open `/users` and open the target staff member's individual permissions.
3. Set a POS permission to `DENY` and confirm.
4. Verify the modal reports one explicit deny.
5. Verify the staff table reports one custom override.
6. Inspect `syncQueue`; the permission item should be processed and removed after success.
7. Query Supabase:

```sql
SELECT user_id, permission_id, effect, updated_at
FROM public.user_permission_overrides
ORDER BY updated_at DESC;
```

8. Confirm one row exists for the target staff member using the canonical auth user ID.
9. Browser B: sign in as an admin, hard refresh `/users`, and verify the same custom override count.
10. Open the modal in Browser B and verify the same denied POS permission.
11. Sign in as the affected staff user in both browsers.
12. Verify POS is denied in both browsers.
13. Refresh both staff sessions and verify the denial remains.

## Safe Local Reset

Only after Supabase contains the expected row and the queue item has succeeded may you reset a browser cache:

```js
await indexedDB.deleteDatabase("JustSlySuiteDB");
```

Reload and sign in again. The override must rehydrate from Supabase. If it does not, stop and inspect the remote row, RLS response, and network request before repeating the reset.

## Completion Criteria

The fix is complete only when all conditions hold:

- Supabase contains exactly one canonical override row for the test user and permission.
- No legacy staff-ID override remains for that logical permission.
- No failed permission queue item remains in either browser.
- The `/users` table and permission modal agree in both browsers.
- The affected staff account is denied POS in both browsers after refresh.
- Build validation succeeds.

## Stop Conditions

Stop the recovery and preserve evidence if:

- Supabase reports an RLS error.
- The backfill would violate the unique constraint.
- The deployed bundle still reports a missing sync handler after a hard refresh.
- A permission item fails with an error other than the known missing-handler error.
- Clearing IndexedDB would destroy the only unsynchronized copy of the change.
