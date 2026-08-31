-- Supabase Migration: 20260823_user_permission_overrides.sql
-- Granular Staff Permissions & Individual Permission Overrides Layer

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL DEFAULT 'org-default',
    user_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    effect TEXT NOT NULL CHECK (effect IN ('GRANT', 'DENY')),
    reason TEXT,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_permission_override UNIQUE (organization_id, user_id, permission_id)
);

-- Maintain canonical auth-user-based identity across browsers and staff records.
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_permission
    ON public.user_permission_overrides (user_id, permission_id);

-- Backfill any legacy rows created from a staff UUID so all browsers read the same auth identity.
UPDATE public.user_permission_overrides o
SET user_id = s.auth_user_id::text
FROM public.staff s
WHERE s.id = o.user_id
  AND s.auth_user_id IS NOT NULL
  AND o.user_id <> s.auth_user_id::text;

-- Indexes for optimal multi-tenant and user permission resolution queries
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_org_user 
    ON public.user_permission_overrides (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_perm 
    ON public.user_permission_overrides (user_id, permission_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies with Multi-Tenant Isolation
DROP POLICY IF EXISTS "Users can view permission overrides for their organization"
    ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Admins can insert permission overrides in their organization"
    ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Admins can update permission overrides in their organization"
    ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Admins can delete permission overrides in their organization"
    ON public.user_permission_overrides;

CREATE POLICY "Users can view permission overrides for their organization"
    ON public.user_permission_overrides FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert permission overrides in their organization"
    ON public.user_permission_overrides FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update permission overrides in their organization"
    ON public.user_permission_overrides FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete permission overrides in their organization"
    ON public.user_permission_overrides FOR DELETE
    USING (auth.uid() IS NOT NULL);
