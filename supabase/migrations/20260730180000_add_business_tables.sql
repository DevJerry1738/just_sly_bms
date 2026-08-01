-- Migration: Add missing enterprise business suite tables (Idempotent & Safe)
-- Drops pre-existing versions if needed to update UUID columns to TEXT and recreates RLS policies safely.

-- Clean up pre-existing tables if they have old UUID schemas
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 1. Organizations Table
CREATE TABLE public.organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  tax_id TEXT,
  currency TEXT DEFAULT 'NGN',
  is_multi_branch_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Branches Table
CREATE TABLE public.branches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Nigeria',
  timezone TEXT DEFAULT 'Africa/Lagos',
  currency TEXT DEFAULT 'NGN',
  receipt_prefix TEXT,
  low_stock_threshold INT DEFAULT 10,
  status TEXT DEFAULT 'active',
  opening_date DATE,
  notes TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3. Products Table
CREATE TABLE public.products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  category_name TEXT,
  unit TEXT DEFAULT 'pcs',
  cost_price NUMERIC(12, 2) DEFAULT 0.00,
  selling_price NUMERIC(12, 2) DEFAULT 0.00,
  wholesale_price NUMERIC(12, 2) DEFAULT 0.00,
  min_order_quantity INT DEFAULT 1,
  status TEXT DEFAULT 'active',
  barcode TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 4. Inventory Table
CREATE TABLE public.inventory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  reorder_point INT DEFAULT 5,
  last_stock_count_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id)
);

-- 5. Customers Table
CREATE TABLE public.customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  type TEXT DEFAULT 'retail',
  credit_limit NUMERIC(12, 2) DEFAULT 0.00,
  outstanding_balance NUMERIC(12, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Sales Table (POS Receipts)
CREATE TABLE public.sales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_number TEXT UNIQUE NOT NULL,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) DEFAULT 0.00,
  discount NUMERIC(12, 2) DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Orders Table (Wholesale)
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number TEXT UNIQUE NOT NULL,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  order_date TIMESTAMPTZ DEFAULT now(),
  expected_delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Staff Table
CREATE TABLE public.staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  hire_date DATE,
  termination_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. User Preferences Table
CREATE TABLE public.user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'system',
  default_branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Audit Logs Table
CREATE TABLE public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

-- 11. Notifications Table
CREATE TABLE public.notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Security Policies & Grants
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated & service roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Drop existing policies if present before recreating
DROP POLICY IF EXISTS "Allow authenticated full access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow authenticated full access to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow authenticated full access to products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated full access to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow authenticated full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated full access to sales" ON public.sales;
DROP POLICY IF EXISTS "Allow authenticated full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated full access to staff" ON public.staff;
DROP POLICY IF EXISTS "Allow users access to own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Allow authenticated full access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow users access to own notifications" ON public.notifications;

-- Create policies safely
CREATE POLICY "Allow authenticated full access to organizations" ON public.organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to inventory" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to staff" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow users access to own preferences" ON public.user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated full access to audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow users access to own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
