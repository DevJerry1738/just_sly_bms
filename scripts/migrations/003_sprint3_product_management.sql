-- ==========================================
-- Sprint 3 Database Migration (Supabase PostgreSQL)
-- Product & Pricing Management Module
-- ==========================================

-- 1. Create units_of_measure Table
CREATE TABLE IF NOT EXISTS public.units_of_measure (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(50) NOT NULL,
  allow_decimals BOOLEAN DEFAULT false NOT NULL,
  precision INT DEFAULT 0 NOT NULL,
  is_system BOOLEAN DEFAULT false NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(255) REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- 3. Create products Table
CREATE TABLE IF NOT EXISTS public.products (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id VARCHAR(255) REFERENCES public.categories(id) ON DELETE SET NULL,
  brand VARCHAR(255),
  manufacturer VARCHAR(255),
  base_unit VARCHAR(100) DEFAULT 'Piece' NOT NULL,
  track_expiry BOOLEAN DEFAULT false NOT NULL,
  low_stock_threshold NUMERIC(15, 3) DEFAULT 0 NOT NULL,
  cost_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
  retail_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
  wholesale_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
  supply_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- 4. Create product_packaging Table
CREATE TABLE IF NOT EXISTS public.product_packaging (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  label VARCHAR(100) NOT NULL,
  units_per_package NUMERIC(15, 3) NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_packaging_product_id ON public.product_packaging(product_id);

-- 5. Create price_history Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.price_history (
  id VARCHAR(255) PRIMARY KEY,
  product_id VARCHAR(255) REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  price_type VARCHAR(50) NOT NULL, -- 'cost', 'retail', 'wholesale', 'supply'
  previous_price NUMERIC(15, 2) NOT NULL,
  new_price NUMERIC(15, 2) NOT NULL,
  changed_by VARCHAR(255),
  changed_by_name VARCHAR(255),
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON public.price_history(timestamp DESC);

-- 6. Add product_code_prefix to organizations table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='organizations' AND column_name='product_code_prefix'
    ) THEN
        ALTER TABLE public.organizations ADD COLUMN product_code_prefix VARCHAR(20) DEFAULT 'JSP';
    END IF;
END $$;

-- Enable Row Level Security (RLS) policies if needed
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Default permissive read/write policies for authenticated users
CREATE POLICY "Allow read for all users" ON public.units_of_measure FOR SELECT USING (true);
CREATE POLICY "Allow read for all users" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow read for all users" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow read for all users" ON public.product_packaging FOR SELECT USING (true);
CREATE POLICY "Allow read for all users" ON public.price_history FOR SELECT USING (true);

CREATE POLICY "Allow write for authenticated users" ON public.units_of_measure FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated users" ON public.categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated users" ON public.products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated users" ON public.product_packaging FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated users" ON public.price_history FOR ALL USING (auth.role() = 'authenticated');
