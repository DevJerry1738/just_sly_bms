# QA Test Case 01: HQ-Only Wholesale Order Fulfillment

## Objective
Verify that all wholesale orders are strictly associated with HQ, use HQ stock for availability checks, and prevent branch selection.

## Pre-conditions
- Organization has HQ branch ("Lagos Central Flagship (HQ)") and at least 1 regional branch ("Kano North Outlet").
- Products exist with inventory balances at HQ and regional branches.

## Test Steps
1. Log in as a wholesale customer at `/portal/login`.
2. Browse the catalogue at `/portal/shop`.
3. Verify there is NO option to select a branch or fulfillment location.
4. Place an order for 10 units of Product A.
5. Inspect the generated `WholesaleOrderSchema` record in IndexedDB (`db.wholesale_orders`).

## Expected Results
- `hqBranchId` on the order automatically equals the HQ branch ID (`branch-hq-lagos`).
- Customer cannot select or alter fulfillment location.
- Product availability on the catalogue reflects HQ stock only.
- Regional branch inventory is completely untouched.
