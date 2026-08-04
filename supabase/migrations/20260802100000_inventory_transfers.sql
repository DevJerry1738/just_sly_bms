-- ============================================================================
-- Sprint 5: Inventory Distribution & Branch Supply
-- ============================================================================
-- Creates transfer documents, reservations, and status history for:
-- - HQ → Branch Supplies
-- - Branch → Branch Transfers
--
-- Key principles:
-- 1. Stock reserved on creation (prevents overselling)
-- 2. Stock deducted only on dispatch via inventory_transactions
-- 3. All status changes tracked for audit trail
-- 4. Batch allocation preserves expiry dates (FIFO)
-- ============================================================================

-- ============================================================================
-- Core Transfer Documents
-- ============================================================================

CREATE TABLE public.inventory_transfers (
  id TEXT PRIMARY KEY,
  transfer_number TEXT UNIQUE NOT NULL,    -- TRF-YYYYMMDD-XXXX
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('hq_supply', 'branch_transfer')),
  source_branch_id TEXT NOT NULL REFERENCES public.branches(id),
  destination_branch_id TEXT NOT NULL REFERENCES public.branches(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_dispatch', 'dispatched', 'in_transit', 
    'pending_receipt', 'received', 'rejected', 'cancelled'
  )),
  notes TEXT,
  reference_document_number TEXT,         -- optional waybill/delivery note
  expected_arrival_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_transfers_source ON public.inventory_transfers(source_branch_id);
CREATE INDEX idx_inventory_transfers_destination ON public.inventory_transfers(destination_branch_id);
CREATE INDEX idx_inventory_transfers_status ON public.inventory_transfers(status);
CREATE INDEX idx_inventory_transfers_created_by ON public.inventory_transfers(created_by);
CREATE INDEX idx_inventory_transfers_created_at ON public.inventory_transfers(created_at);

-- ============================================================================
-- Transfer Line Items (products/quantities/packaging/batches)
-- ============================================================================

CREATE TABLE public.inventory_transfer_items (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id),
  packaging_unit TEXT,                     -- e.g., 'Carton', 'Box', null = base unit
  quantity_in_packaging NUMERIC(12, 4),    -- 5 (if packaging_unit='Carton')
  converted_base_quantity NUMERIC(12, 4),  -- 120 (5 Cartons × 24 per carton)
  unit_cost_snapshot NUMERIC(12, 4),       -- cost per base unit at time of transfer
  batch_id TEXT REFERENCES public.inventory_batches(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transfer_items_transfer ON public.inventory_transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_product ON public.inventory_transfer_items(product_id);
CREATE INDEX idx_transfer_items_batch ON public.inventory_transfer_items(batch_id);

-- ============================================================================
-- Batch Allocations for Transfers (expiry tracking)
-- ============================================================================

CREATE TABLE public.inventory_transfer_batches (
  id TEXT PRIMARY KEY,
  transfer_item_id TEXT NOT NULL REFERENCES public.inventory_transfer_items(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES public.inventory_batches(id),
  batch_number TEXT,
  expiry_date DATE,
  quantity_allocated NUMERIC(12, 4),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transfer_batches_item ON public.inventory_transfer_batches(transfer_item_id);
CREATE INDEX idx_transfer_batches_batch ON public.inventory_transfer_batches(batch_id);

-- ============================================================================
-- Reservations (prevents overselling)
-- ============================================================================

CREATE TABLE public.inventory_reservations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id),
  branch_id TEXT NOT NULL REFERENCES public.branches(id),
  transfer_id TEXT REFERENCES public.inventory_transfers(id),
  quantity_reserved NUMERIC(12, 4) NOT NULL,
  base_unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  UNIQUE(product_id, branch_id, transfer_id)
);

CREATE INDEX idx_reservations_product_branch ON public.inventory_reservations(product_id, branch_id);
CREATE INDEX idx_reservations_transfer ON public.inventory_reservations(transfer_id);
CREATE INDEX idx_reservations_released ON public.inventory_reservations(released_at);

-- ============================================================================
-- Status Change History (audit trail)
-- ============================================================================

CREATE TABLE public.transfer_status_history (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_status_history_transfer ON public.transfer_status_history(transfer_id);
CREATE INDEX idx_status_history_timestamp ON public.transfer_status_history(timestamp);

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================

-- Enable RLS on all transfer tables
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- inventory_transfers RLS
-- ============================================================================

-- Users can view transfers involving their branch
CREATE POLICY "view_transfers_own_branch" ON public.inventory_transfers
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id = inventory_transfers.source_branch_id 
          OR staff.branch_id = inventory_transfers.destination_branch_id)
    )
  );

-- Users can create transfers from their branch
CREATE POLICY "create_transfer" ON public.inventory_transfers
  FOR INSERT WITH CHECK (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE staff.branch_id = source_branch_id
    )
  );

-- Users can update transfers involving their branch
CREATE POLICY "update_transfer" ON public.inventory_transfers
  FOR UPDATE USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id = inventory_transfers.source_branch_id 
          OR staff.branch_id = inventory_transfers.destination_branch_id)
    )
  );

-- ============================================================================
-- inventory_transfer_items RLS
-- ============================================================================

CREATE POLICY "view_transfer_items" ON public.inventory_transfer_items
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id IN (
        SELECT source_branch_id FROM public.inventory_transfers WHERE id = transfer_id
        UNION
        SELECT destination_branch_id FROM public.inventory_transfers WHERE id = transfer_id
      ))
    )
  );

CREATE POLICY "manage_transfer_items" ON public.inventory_transfer_items
  FOR INSERT WITH CHECK (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE staff.branch_id IN (
        SELECT source_branch_id FROM public.inventory_transfers WHERE id = transfer_id
      )
    )
  );

-- ============================================================================
-- inventory_transfer_batches RLS
-- ============================================================================

CREATE POLICY "view_transfer_batches" ON public.inventory_transfer_batches
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id IN (
        SELECT DISTINCT source_branch_id FROM public.inventory_transfers it
        JOIN public.inventory_transfer_items iti ON iti.transfer_id = it.id
        WHERE iti.id = transfer_item_id
        UNION
        SELECT DISTINCT destination_branch_id FROM public.inventory_transfers it
        JOIN public.inventory_transfer_items iti ON iti.transfer_id = it.id
        WHERE iti.id = transfer_item_id
      ))
    )
  );

-- ============================================================================
-- inventory_reservations RLS
-- ============================================================================

CREATE POLICY "view_reservations" ON public.inventory_reservations
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE staff.branch_id = branch_id
    )
  );

CREATE POLICY "manage_reservations" ON public.inventory_reservations
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE staff.branch_id = branch_id
    )
  );

-- ============================================================================
-- transfer_status_history RLS
-- ============================================================================

CREATE POLICY "view_status_history" ON public.transfer_status_history
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id IN (
        SELECT source_branch_id FROM public.inventory_transfers WHERE id = transfer_id
        UNION
        SELECT destination_branch_id FROM public.inventory_transfers WHERE id = transfer_id
      ))
    )
  );

CREATE POLICY "create_status_history" ON public.transfer_status_history
  FOR INSERT WITH CHECK (
    auth.uid()::text IN (
      SELECT staff.auth_user_id::text FROM public.staff 
      WHERE (staff.branch_id IN (
        SELECT source_branch_id FROM public.inventory_transfers WHERE id = transfer_id
        UNION
        SELECT destination_branch_id FROM public.inventory_transfers WHERE id = transfer_id
      ))
    )
  );
