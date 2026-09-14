-- Extend normalized wholesale tables to match offline sync payloads.
-- This migration is additive so existing deployments retain their history.

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS payment_id TEXT REFERENCES public.order_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
  ADD COLUMN IF NOT EXISTS public_url TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS payment_receipts_payment_idx
  ON public.payment_receipts (payment_id);

CREATE INDEX IF NOT EXISTS invoices_order_idx
  ON public.invoices (order_id);
