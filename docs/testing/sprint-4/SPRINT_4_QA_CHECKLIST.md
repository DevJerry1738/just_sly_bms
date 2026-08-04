# Sprint 4 QA Sign-off Checklist

- [x] **Schema Migration**: Dexie v5 schema defined with 7 new inventory tables.
- [x] **SQL Script**: `004_sprint4_inventory.sql` created with RLS policies and indexes.
- [x] **Ledger Immutability**: All stock movements generate immutable `inventory_transactions`.
- [x] **Packaging Conversion**: Packaging units automatically convert to base units before transaction entry.
- [x] **FIFO Valuation**: `inventoryValuationService` allocates depletion ordered by expiry date.
- [x] **Stock Count Session**: 7-step physical reconciliation workflow implemented.
- [x] **Alerts**: Low stock and batch expiry alerts generated and mirrored into notifications.
- [x] **RBAC**: Inventory permissions added and gated by system roles.
- [x] **Build Verification**: Clean compilation with `npm run build` (zero errors).
