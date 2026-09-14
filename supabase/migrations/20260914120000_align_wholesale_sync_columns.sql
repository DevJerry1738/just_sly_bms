-- Align wholesale transaction tables with the browser sync payloads.
-- This migration is additive so existing normalized records remain valid.

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size NUMERIC(14, 0),
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
  ADD COLUMN IF NOT EXISTS public_url TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.invoices
SET
  amount_due = COALESCE(amount_due, amount),
  created_at = COALESCE(created_at, issued_at),
  updated_at = COALESCE(updated_at, issued_at),
  status = COALESCE(status, 'unpaid')
WHERE amount_due IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL
   OR status IS NULL;

CREATE INDEX IF NOT EXISTS order_payments_order_idx
  ON public.order_payments (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_receipts_order_idx
  ON public.payment_receipts (order_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS invoices_order_idx
  ON public.invoices (order_id, issued_at DESC);
