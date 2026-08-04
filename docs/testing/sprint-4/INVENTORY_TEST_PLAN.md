# Sprint 4 Test Plan — Inventory Management Module

## 1. Overview
This document outlines the testing strategy for the **Sprint 4 Inventory Management Module**.

## 2. Test Scope
- Immutable Transaction Ledger (`inventory_transactions`)
- Cached Current Stock Balances (`inventory_balances`)
- Batch & FIFO Expiry Tracking (`inventory_batches`)
- Reason-coded Stock Adjustments (`inventory_adjustments`)
- Stock Count (Stock Take) & Reconciliation (`stock_count_sessions`, `stock_count_items`)
- Low Stock & Expiry Alerts (`inventory_alerts`)
- Offline-First Synchronization & Conflict Resolution

## 3. Test Suites & File References
| Document | Focus Area |
|---|---|
| [LEDGER_VALIDATION_TESTS.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/LEDGER_VALIDATION_TESTS.md) | Ledger immutability, balance deltas, and packaging unit conversion |
| [BATCH_AND_EXPIRY_TESTS.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/BATCH_AND_EXPIRY_TESTS.md) | FIFO layer allocation, batch deductions, and 7/30/60/90-day expiry timelines |
| [LOW_STOCK_TESTS.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/LOW_STOCK_TESTS.md) | Threshold comparisons, low stock vs out-of-stock badge state transitions |
| [OFFLINE_SYNC_TESTS.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/OFFLINE_SYNC_TESTS.md) | Offline opening stock, adjustments, count sessions, sync queue drain |
| [SPRINT_4_QA_CHECKLIST.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/SPRINT_4_QA_CHECKLIST.md) | Executive QA sign-off checklist covering acceptance criteria |
| [MANUAL_TEST_GUIDE.md](file:///c:/Users/jerem/Documents/Just%20Sly/Just_Sly/business-suite-main/docs/testing/sprint-4/MANUAL_TEST_GUIDE.md) | Step-by-step user walkthrough guide for testing UI and workflows |
