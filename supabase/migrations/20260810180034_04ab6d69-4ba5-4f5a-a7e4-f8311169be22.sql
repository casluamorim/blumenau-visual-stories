ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS deadline_alert_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stalled_alert_hours integer NOT NULL DEFAULT 48;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cycle_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cycle_label text,
  ADD COLUMN IF NOT EXISTS is_monthly boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_view_client_via_project(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_access pa
    JOIN public.projects p ON p.id = pa.project_id
    WHERE pa.user_id = _user_id AND p.client_id = _client_id
  );
$$;

DROP POLICY IF EXISTS "Projects viewable by linked" ON public.projects;
CREATE POLICY "Projects viewable by linked"
  ON public.projects FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), id));

DROP POLICY IF EXISTS "Projects updatable by editors" ON public.projects;
CREATE POLICY "Projects updatable by editors"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), id));

DROP POLICY IF EXISTS "Clients viewable by linked" ON public.clients;
CREATE POLICY "Clients viewable by linked"
  ON public.clients FOR SELECT TO authenticated
  USING (
    public.can_access_client(auth.uid(), id)
    OR public.can_view_client_via_project(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Contents viewable by linked" ON public.contents;
CREATE POLICY "Contents viewable by linked"
  ON public.contents FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Contents insertable by editors" ON public.contents;
CREATE POLICY "Contents insertable by editors"
  ON public.contents FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Contents updatable by editors" ON public.contents;
CREATE POLICY "Contents updatable by editors"
  ON public.contents FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Contents deletable by editors" ON public.contents;
CREATE POLICY "Contents deletable by editors"
  ON public.contents FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));