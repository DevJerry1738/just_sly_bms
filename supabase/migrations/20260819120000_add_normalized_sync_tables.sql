-- Normalized persistence tables for offline-first customer, POS, and wholesale data.
-- These tables mirror the browser IndexedDB entities used by the application.

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id TEXT PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_code TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  credit_limit NUMERIC(14, 2),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_normalized (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  sale_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_tendered NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_method TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES public.sales_normalized(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  packaging_label TEXT,
  quantity NUMERIC(14, 3) NOT NULL,
  base_quantity NUMERIC(14, 3) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  cost_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES public.sales_normalized(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_voids (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES public.sales_normalized(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  voided_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inventory_reversed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.wholesale_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  hq_branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wholesale_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  selling_unit TEXT NOT NULL,
  units_per_package NUMERIC(14, 3) NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  base_quantity NUMERIC(14, 3) NOT NULL,
  unit_price_snapshot NUMERIC(14, 2) NOT NULL,
  cost_price_snapshot NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  bank_name TEXT,
  transfer_reference TEXT,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(14, 2) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_accounts_email_idx ON public.customer_accounts (lower(email));
CREATE INDEX IF NOT EXISTS sales_normalized_branch_created_idx ON public.sales_normalized (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_payments_sale_idx ON public.sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS wholesale_orders_customer_created_idx ON public.wholesale_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wholesale_order_items_order_idx ON public.wholesale_order_items (order_id);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON public.order_status_history (order_id, timestamp DESC);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_normalized ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customer_accounts', 'sales_normalized', 'sale_items', 'sale_payments',
    'sale_voids', 'wholesale_orders', 'wholesale_order_items',
    'order_status_history', 'order_payments', 'payment_receipts', 'invoices'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_sync_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "authenticated_sync_%s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name, table_name);
  END LOOP;
END $$;

GRANT ALL ON TABLE
  public.customer_accounts, public.sales_normalized, public.sale_items, public.sale_payments,
  public.sale_voids, public.wholesale_orders, public.wholesale_order_items,
  public.order_status_history, public.order_payments, public.payment_receipts, public.invoices
TO authenticated, service_role;
