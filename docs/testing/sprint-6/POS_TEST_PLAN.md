# Sprint 6 — Retail POS Test Plan

## Overview
This document outlines the end-to-end testing procedures for the Sprint 6 Retail POS module, covering product search, multi-level packaging selection, cart management, checkout execution, thermal receipt printing, sales history, voiding workflow with inventory reversal, and offline IndexedDB sync queue behavior.

---

## Test Suites

| ID | Test Suite | Scope | Target Component |
|----|------------|-------|------------------|
| TS-01 | Product Grid & Search | Filtering, stock checking, branch scope | `product-grid.tsx`, `product-search.tsx` |
| TS-02 | Cart & Multi-Unit Packaging | Quantity input, packaging conversion, price math | `cart-pane.tsx`, `pos.service.ts` |
| TS-03 | Checkout & Payment | Payment methods, discount calculation, sale creation | `checkout-modal.tsx`, `pos.service.ts` |
| TS-04 | Receipt & Thermal Printing | Formatting, receipt header/footer, window.print, reprint logging | `receipt-view.tsx` |
| TS-05 | Sales History & Voiding | Past sales view, authorized voiding, stock reversal | `sales-history.tsx`, `sale-detail.tsx`, `void.service.ts` |
| TS-06 | Offline & IndexedDB Sync | Disconnected sale, SyncQueue enqueueing, re-connection sync | `sync-queue.ts`, `schema.ts` |

---

## Execution Prerequisites
1. User logged in with valid branch assigned.
2. Active products with both Base Units (e.g., Piece) and Packaging Configurations (e.g., Pack of 10, Carton of 50).
3. Local IndexedDB cleared or initialized with Schema v7.
