# Offline-First PWA Architecture & Developer Guide

## Overview

The **Just Sly Business Management Suite** is built on an **Offline-First Progressive Web Application (PWA)** architecture. Every feature module (Inventory, Retail POS, Wholesale Orders, Branch Registry, Customers, etc.) reads and writes data through a decoupled local data layer rather than making direct HTTP requests to Supabase or accessing IndexedDB directly.

---

## 🏗 Architecture Layers

```
+-------------------------------------------------------------+
|                     React UI Components                     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 Application / Feature Hooks                 |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|           Entity Repositories (BaseRepository<T>)           |
| (ProductsRepository, SalesRepository, InventoryRepository)  |
+-------------------------------+-----------------------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
+---------------+                               +---------------+
|   IndexedDB   |                               |  Sync Queue   |
| (Dexie.js DB) |                               | (Persistent)  |
+---------------+                               +---------------+
                                                        |
                                                        v
                                                +---------------+
                                                | Sync Manager  |
                                                |  & Scheduler  |
                                                +---------------+
                                                        |
                                                        v
                                                +---------------+
                                                | Supabase API  |
                                                +---------------+
```

---

## 🛠 How Future Modules Integrate

### 1. Consuming Repositories in Feature Code

UI components and custom hooks **must never** call `supabase.from(...)` or `db.table(...)` directly. Always import and use the appropriate repository instance:

```typescript
import { productsRepository } from "@/repositories/entity.repositories";

// Read operation — Instant local read from IndexedDB
const products = await productsRepository.getAll();

// Create operation — Writes to local IndexedDB AND enqueues 'CREATE' in SyncQueue
await productsRepository.create({
  sku: "PROD-99",
  name: "Wireless Scanner",
  status: "active"
});

// Update operation — Updates local IndexedDB AND enqueues 'UPDATE' in SyncQueue
await productsRepository.update(productId, { name: "Updated Name" });

// Delete operation — Removes from local IndexedDB AND enqueues 'DELETE' in SyncQueue
await productsRepository.delete(productId);
```

---

### 2. Registering Feature Sync Handlers

When a feature module is implemented, register its backend sync handler with `SyncManager`:

```typescript
import { SyncManager } from "@/services/sync/sync-manager";
import { supabase } from "@/integrations/supabase/client";

SyncManager.registerHandler("products", async (operation, payload) => {
  switch (operation) {
    case "CREATE":
    case "UPSERT": {
      const { error } = await supabase.from("products").upsert(payload);
      return { success: !error, error: error?.message };
    }
    case "UPDATE": {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      return { success: !error, error: error?.message };
    }
    case "DELETE": {
      const { error } = await supabase.from("products").delete().eq("id", payload.id);
      return { success: !error, error: error?.message };
    }
  }
});
```

---

### 3. Monitoring Network & Sync State

Use `useNetworkStatus()` in UI components to render offline status or unsynced change count:

```tsx
import { useNetworkStatus } from "@/hooks/use-network-status";

export function StockStatusComponent() {
  const { status, unsyncedCount, isSyncing } = useNetworkStatus();

  return (
    <div>
      <p>Connection: {status}</p>
      {unsyncedCount > 0 && <p>{unsyncedCount} changes waiting to sync</p>}
    </div>
  );
}
```

---

## 🔐 Security & Token Isolation

- **Authentication Tokens**: Stored exclusively in Supabase Auth session storage / secure cookies. **Never** saved in IndexedDB or Service Worker caches.
- **Sensitive Fields**: If a payload contains sensitive data, encrypt before enqueuing via custom transformer functions before writing to IndexedDB.

---

## Permission Override Sync Contract

Permission overrides use the following persistence contract:

1. Supabase `public.user_permission_overrides` is the cross-browser source of truth.
2. IndexedDB database `JustSlySuiteDB` is a local cache and durable mutation queue.
3. `user_id` is stored canonically as the authenticated Supabase user ID, represented as text to match the table schema.
4. Legacy staff IDs and emails may be accepted as lookup aliases, but they must not be written as the canonical remote identity.
5. `user_permission_overrides` must have a registered `SyncManager` handler before queue processing begins.

### Queue Status Meaning

- `pending`: waiting to be uploaded
- `syncing`: currently being uploaded
- `failed`: upload did not complete; inspect `errorMessage` before retrying
- removed: upload completed successfully

A local modal or POS restriction can work while a record is still only in IndexedDB. That is not proof of cross-browser persistence. Confirm the corresponding Supabase row before clearing local storage or declaring synchronization complete.

### Production Recovery Order

1. Preserve failed permission payloads in `JustSlySuiteDB.syncQueue`.
2. Deploy a bundle containing `entity-sync-handlers` and the targeted permission recovery logic.
3. Refresh service-worker assets only if the browser is serving an old bundle.
4. Retry only failed `user_permission_overrides` records with the known missing-handler error.
5. Confirm the row in Supabase.
6. Clear IndexedDB only after remote persistence is confirmed and a clean rehydration is required.

Never bulk-requeue a large unrelated queue backlog as part of permission recovery. Never delete `JustSlySuiteDB` before preserving unsynchronized permission payloads.

### Browser Inspection

Use DevTools -> **Application -> IndexedDB -> JustSlySuiteDB** and inspect:

- `user_permission_overrides`: local permission records
- `syncQueue`: pending or failed mutations

The console database name is `JustSlySuiteDB`, not `justsly-db`. A successful end-to-end test requires the same canonical `userId` in both browsers and one matching row in Supabase.
