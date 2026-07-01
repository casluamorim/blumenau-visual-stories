
-- 1) client_access_tokens: revoke anon SELECT, expose only via security-definer resolver
DROP POLICY IF EXISTS "Active tokens readable by anyone" ON public.client_access_tokens;

CREATE OR REPLACE FUNCTION public.get_client_id_by_access_token(_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id
  FROM public.client_access_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_client_id_by_access_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_client_id_by_access_token(text) TO anon, authenticated;

-- 2) content_comments: prevent impersonation
DROP POLICY IF EXISTS "content_comments insert auth" ON public.content_comments;
CREATE POLICY "content_comments insert auth"
ON public.content_comments
FOR INSERT
TO authenticated
WITH CHECK (
  (author_user_id IS NULL OR author_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_comments.content_id
      AND (
        NOT has_role(auth.uid(), 'client'::app_role)
        OR can_access_client(auth.uid(), p.client_id)
      )
  )
);

-- 3) content_versions: tighten insert/update
DROP POLICY IF EXISTS "Versions manageable by authenticated" ON public.content_versions;
DROP POLICY IF EXISTS "Versions updatable by authenticated" ON public.content_versions;

CREATE POLICY "content_versions insert scoped"
ON public.content_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_versions.content_id
      AND can_edit_client(auth.uid(), p.client_id)
  )
);

CREATE POLICY "content_versions update scoped"
ON public.content_versions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_versions.content_id
      AND can_edit_client(auth.uid(), p.client_id)
  )
);

CREATE POLICY "content_versions delete scoped"
ON public.content_versions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_versions.content_id
      AND can_edit_client(auth.uid(), p.client_id)
  )
);

-- 4) user_roles: restrict to self or admin
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users see own role or admin sees all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 5) agency_settings: 2nd PIX key + labels
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS pix_key_1_label text,
  ADD COLUMN IF NOT EXISTS pix_key_2 text,
  ADD COLUMN IF NOT EXISTS pix_key_2_type text,
  ADD COLUMN IF NOT EXISTS pix_key_2_label text;

-- 6) clients: preferred PIX key ('1' or '2')
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS preferred_pix_key text
    CHECK (preferred_pix_key IN ('1','2') OR preferred_pix_key IS NULL);
