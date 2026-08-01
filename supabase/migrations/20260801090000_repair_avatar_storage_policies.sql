-- Repair avatar policies for projects that already applied the initial bucket migration.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own avatars" ON storage.objects;

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