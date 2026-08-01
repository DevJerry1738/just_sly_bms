-- Configure the public avatar bucket used by src/services/user-profile.service.ts.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Authenticated users can upload their own avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE 'user-' || (select auth.uid()::text) || '/%'
  );

CREATE POLICY "Authenticated users can read their own avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE 'user-' || (select auth.uid()::text) || '/%'
  );

CREATE POLICY "Authenticated users can update their own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE 'user-' || (select auth.uid()::text) || '/%'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE 'user-' || (select auth.uid()::text) || '/%'
  );

CREATE POLICY "Authenticated users can delete their own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE 'user-' || (select auth.uid()::text) || '/%'
  );

GRANT SELECT ON public.profiles TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated users can view profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view profiles"
      ON public.profiles FOR SELECT TO authenticated USING (true);
  END IF;
END
$$;