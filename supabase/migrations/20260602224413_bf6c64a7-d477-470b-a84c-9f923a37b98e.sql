
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);

CREATE OR REPLACE FUNCTION public.can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND auth_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.client_assignments WHERE client_id = _client_id AND user_id = _user_id);
$$;

-- content_versions
DROP POLICY IF EXISTS "Versions viewable by authenticated" ON public.content_versions;
CREATE POLICY "Versions viewable by authenticated" ON public.content_versions FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_versions.content_id AND public.can_access_client(auth.uid(), p.client_id)
  )
);

-- comments
DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.comments;
CREATE POLICY "Comments viewable by authenticated" ON public.comments FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR EXISTS (
    SELECT 1 FROM public.content_versions cv
    JOIN public.contents c ON c.id = cv.content_id
    JOIN public.projects p ON p.id = c.project_id
    WHERE cv.id = comments.content_version_id AND public.can_access_client(auth.uid(), p.client_id)
  )
);

-- content_comments
DROP POLICY IF EXISTS "content_comments select auth" ON public.content_comments;
CREATE POLICY "content_comments select auth" ON public.content_comments FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR EXISTS (
    SELECT 1 FROM public.contents c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = content_comments.content_id AND public.can_access_client(auth.uid(), p.client_id)
  )
);

-- quotes: split ALL into specific policies so clients only read their own
DROP POLICY IF EXISTS "Quotes manageable by authenticated" ON public.quotes;
CREATE POLICY "Quotes select" ON public.quotes FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR public.can_access_client(auth.uid(), client_id)
);
CREATE POLICY "Quotes insert" ON public.quotes FOR INSERT TO authenticated WITH CHECK (
  NOT public.has_role(auth.uid(), 'client'::app_role)
);
CREATE POLICY "Quotes update" ON public.quotes FOR UPDATE TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role)
);
CREATE POLICY "Quotes delete" ON public.quotes FOR DELETE TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role)
);

-- profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR user_id = auth.uid()
);

-- activity_logs
DROP POLICY IF EXISTS "Logs viewable by authenticated" ON public.activity_logs;
CREATE POLICY "Logs viewable by authenticated" ON public.activity_logs FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role)
);

-- user_roles
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (
  NOT public.has_role(auth.uid(), 'client'::app_role) OR user_id = auth.uid()
);
