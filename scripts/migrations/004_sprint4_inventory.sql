-- ============================================================================
-- Sprint 4 Migration: Inventory Management Module
-- Run this script in the Supabase SQL Editor for your project.
-- ============================================================================

-- 1. Create inventory_transactions table (Immutable Ledger)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id VARCHAR(255) PRIMARY KEY,
    type TEXT NOT NULL,
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL,
    base_unit TEXT NOT NULL,
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reference_number TEXT NOT NULL UNIQUE,
    batch_id VARCHAR(255),
    session_id VARCHAR(255),
    notes TEXT,
    performed_by TEXT NOT NULL,
    performed_by_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_txns_product ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_branch ON public.inventory_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_type ON public.inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_inv_txns_timestamp ON public.inventory_transactions(timestamp DESC);

-- 2. Create inventory_balances table (Cached Current Stock)
CREATE TABLE IF NOT EXISTS public.inventory_balances (
    id VARCHAR(255) PRIMARY KEY, -- '${product_id}::${branch_id}'
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    incoming_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    valuation_method TEXT NOT NULL DEFAULT 'fifo',
    total_cost_value NUMERIC(15, 4) NOT NULL DEFAULT 0,
    weighted_avg_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    last_transaction_id VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_inv_balance_prod_branch UNIQUE (product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_balances_branch ON public.inventory_balances(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_product ON public.inventory_balances(product_id);

-- 3. Create inventory_batches table (FIFO Lot / Expiry Tracking)
CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id VARCHAR(255) PRIMARY KEY,
    batch_number TEXT NOT NULL,
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0,
    initial_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    manufacture_date DATE,
    expiry_date DATE,
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    supplier_id VARCHAR(255),
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_batches_prod_branch ON public.inventory_batches(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_batches_expiry ON public.inventory_batches(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_inv_batches_status ON public.inventory_batches(status);

-- 4. Create inventory_adjustments table (Adjustment Details)
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id VARCHAR(255) PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    notes TEXT,
    quantity_before NUMERIC(15, 4) NOT NULL,
    quantity_after NUMERIC(15, 4) NOT NULL,
    performed_by TEXT NOT NULL,
    performed_by_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON public.inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_branch ON public.inventory_adjustments(branch_id);

-- 5. Create inventory_alerts table (Low Stock & Expiry Alerts)
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
    id VARCHAR(255) PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    batch_id VARCHAR(255) REFERENCES public.inventory_batches(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    expiry_date DATE,
    days_remaining INTEGER,
    quantity_affected NUMERIC(15, 4) DEFAULT 0,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_alerts_branch ON public.inventory_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_alerts_ack ON public.inventory_alerts(acknowledged);

-- 6. Create stock_count_sessions table (Stock Take Sessions)
CREATE TABLE IF NOT EXISTS public.stock_count_sessions (
    id VARCHAR(255) PRIMARY KEY,
    session_number TEXT NOT NULL UNIQUE,
    branch_id VARCHAR(255) NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    scope TEXT NOT NULL DEFAULT 'full',
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    approved_by_name TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    notes TEXT,
    total_variance_value NUMERIC(15, 4) DEFAULT 0,
    created_by TEXT NOT NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_sessions_branch ON public.stock_count_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_sc_sessions_status ON public.stock_count_sessions(status);

-- 7. Create stock_count_items table (Per-Product Lines in Stock Take)
CREATE TABLE IF NOT EXISTS public.stock_count_items (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    base_unit TEXT NOT NULL,
    batch_id VARCHAR(255) REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
    batch_number TEXT,
    expiry_date DATE,
    system_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    counted_quantity NUMERIC(15, 4),
    variance NUMERIC(15, 4),
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
    variance_value NUMERIC(15, 4),
    notes TEXT,
    counted_by TEXT,
    counted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sc_items_session ON public.stock_count_items(session_id);

-- Enable RLS on all 7 tables
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/write access (RBAC handled application-side)
CREATE POLICY "Allow authenticated inventory_transactions access" ON public.inventory_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated inventory_balances access" ON public.inventory_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated inventory_batches access" ON public.inventory_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated inventory_adjustments access" ON public.inventory_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated inventory_alerts access" ON public.inventory_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated stock_count_sessions access" ON public.stock_count_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated stock_count_items access" ON public.stock_count_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
