
-- 1. Fix privilege escalation: only admins can insert user_roles
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

-- 2. Fix profile self-insert: restrict role column to safe defaults
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (role IS NULL OR role IN ('editor','viewer','client'))
  );

-- 3. Revoke EXECUTE on internal SECURITY DEFINER helpers from public roles.
-- These are only invoked by triggers or from RLS with elevated context.
-- Functions still callable from client (invites/portal tokens) retain their grants.
REVOKE EXECUTE ON FUNCTION public.generate_unique_client_slug(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clients_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_user_invite_accepted(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.slugify(text) FROM PUBLIC, anon, authenticated;

-- 4. Storage policies: enforce ownership on content-files & agency-assets writes,
--    and remove broad listing SELECT policies (public URLs still work).

-- Drop existing loose policies
DROP POLICY IF EXISTS "Authenticated users can upload content files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update content files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete content files" ON storage.objects;
DROP POLICY IF EXISTS "Content files publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload agency assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update agency assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete agency assets" ON storage.objects;
DROP POLICY IF EXISTS "Agency assets publicly readable" ON storage.objects;

-- content-files SELECT: restrict listing to authorized staff/owners.
-- Public URL access (/object/public/...) still bypasses RLS since bucket stays public,
-- but object listing and enumeration via the SDK is no longer permitted for anonymous users.
CREATE POLICY "content-files select by authorized"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (
      -- Staff (any non-client role)
      NOT public.has_role(auth.uid(), 'client'::app_role)
      OR
      -- Project files: first path segment = project_id and user can access its client
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
          AND public.can_access_client(auth.uid(), p.client_id)
      )
      OR
      -- User-scoped expense attachments: expenses/<uid>/... or expenses-pf/<uid>/...
      (split_part(name, '/', 1) IN ('expenses','expenses-pf')
        AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

-- content-files INSERT: only authorized paths
CREATE POLICY "content-files insert by owner"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'content-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
          AND public.can_edit_client(auth.uid(), p.client_id)
      )
      OR (split_part(name, '/', 1) IN ('expenses','expenses-pf')
          AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY "content-files update by owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
          AND public.can_edit_client(auth.uid(), p.client_id)
      )
      OR (split_part(name, '/', 1) IN ('expenses','expenses-pf')
          AND split_part(name, '/', 2) = auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'content-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
          AND public.can_edit_client(auth.uid(), p.client_id)
      )
      OR (split_part(name, '/', 1) IN ('expenses','expenses-pf')
          AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY "content-files delete by owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
          AND public.can_edit_client(auth.uid(), p.client_id)
      )
      OR (split_part(name, '/', 1) IN ('expenses','expenses-pf')
          AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

-- agency-assets: admin-only writes; SELECT restricted (public URL still works)
CREATE POLICY "agency-assets select for staff"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agency-assets'
    AND NOT public.has_role(auth.uid(), 'client'::app_role)
  );

CREATE POLICY "agency-assets insert by admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agency-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "agency-assets update by admin"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agency-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'agency-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "agency-assets delete by admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
