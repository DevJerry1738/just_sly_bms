# Offline Sync Test Plan

## Objective
Verify offline creation of inventory transactions, adjustments, and count sessions with background sync queue draining.

## Test Cases

### TC-OFFLINE-01: Offline Opening Stock & Adjustment
1. Disconnect network / set browser offline.
2. Record opening stock and perform a stock adjustment.
3. Verify local IndexedDB balance updates immediately (optimistic UI update).
4. Verify entries in `syncQueue` table with status `pending`.
5. Reconnect network.
6. Verify sync scheduler drains queue and Supabase tables reflect new transactions.

### TC-OFFLINE-02: Offline Stock Count Session
1. Go offline and start a Stock Count Session.
2. Enter physical counts and approve the session.
3. Confirm local ledger adjustments are created offline.
4. Reconnect network → verify session and adjustments sync to Supabase without conflict.
