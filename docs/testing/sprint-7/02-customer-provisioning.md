# QA Test Case 02: Admin Customer Provisioning & Portal Login

## Objective
Verify that admins can create wholesale customer accounts in the Admin Dashboard, and provisioning enables secure login via `/portal/login`.

## Pre-conditions
- Admin logged into `/customers`.

## Test Steps
1. Click "Add Customer".
2. Fill contactName ("Alhaji Garba"), email ("garba@distributors.ng"), businessName ("Garba & Sons"), status ("active").
3. Click "Create Customer".
4. Navigate to `/portal/login`.
5. Authenticate with credentials for `garba@distributors.ng`.

## Expected Results
- Customer is assigned auto-generated code `CUST-xxxx`.
- Login succeeds and redirects customer to `/portal/shop`.
- Suspended or inactive customer accounts are denied access with clear error message.
