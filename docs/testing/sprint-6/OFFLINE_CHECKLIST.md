# Offline Capability & IndexedDB Sync Checklist

## Scope
Verifies that all POS transactions can take place when network connectivity is offline, stored in Dexie IndexedDB, and synchronized when connection is restored.

---

## Verification Matrix

| Step | Action | Expected Offline Behavior | Sync Verification |
|------|--------|---------------------------|-------------------|
| 1 | Disconnect Network (Chrome DevTools → Offline) | App remains fully operational, reading from IndexedDB tables. | N/A |
| 2 | Complete POS Checkout | Sale stored in `db.sales` with `sync_status: "pending"`. Inventory updated locally. | Mutation queued in `db.syncQueue`. |
| 3 | Print Thermal Receipt | Receipt modal opens, `window.print()` renders using offline DOM. | Receipt prints offline. |
| 4 | Void a Sale Offline | Inventory reversed in local Dexie database. Void record written. | `sales` and `sale_voids` mutations queued. |
| 5 | Re-connect Network | `SyncManager.processQueue()` triggers automatically. | Queue items cleared (`synced: true`). Remote backend synced. |
