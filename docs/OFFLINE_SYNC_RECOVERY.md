# Offline Data Sync And Recovery

## What changed

Local IndexedDB is browser-specific. Localhost and Vercel do not share it. Customer accounts, POS sales, wholesale orders, and their child records now sync through the normalized Supabase tables created by:

`supabase/migrations/20260819120000_add_normalized_sync_tables.sql`

The sync layer now includes:

- Outbound handlers for customers, sales, sale items/payments/voids, wholesale orders, order items/history/payments, receipts, and invoices.
- Pull-sync mappings for a fresh browser or Vercel deployment.
- Catch-up discovery for local rows that were never placed in the queue.
- Parent-child queue dependencies.
- A recovery method that requeues failed records without deleting local data.

## Deployment order

1. Confirm localhost and Vercel use the same Supabase project.
2. Apply the new Supabase migration to that project.
3. Deploy the application with the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` project configuration.
4. Sign in on localhost and keep the browser online.
5. Run the authenticated recovery action that calls `SyncScheduler.recoverLocalData()`.
6. Inspect the returned `syncResult` and the sync status indicator for failed records.
7. Verify the uploaded rows in Supabase before clearing browser data.

## Recovery guarantees

Records still present in localhost IndexedDB can be recovered if their required parent records and referenced products/branches also exist or are recovered. The recovery process uploads parents before children and preserves local rows until verification.

Recovery cannot restore data that was deleted when browser storage was cleared. Records rejected by RLS, invalid foreign keys, or incompatible old schemas are reported as failed and require correction before retrying.

## Verification workflow

1. Create a wholesale customer on localhost and wait for the sync indicator to show no pending records.
2. Create and complete a POS sale with multiple items and a payment.
3. Confirm the customer, sale, sale items, and sale payment exist in Supabase.
4. Open the Vercel deployment in a fresh browser session and confirm the records appear after pull-sync.
5. Create a record on Vercel and confirm it appears on localhost.
6. Test a failed record by correcting its data, then rerun recovery and confirm it becomes synced.

## Important environment check

The localhost and Vercel builds must use the same Supabase URL/project. Matching application code alone does not make two separate Supabase projects share data.
