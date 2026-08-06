-- 1. novo status
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'delayed';

-- 2. enums novos
DO $$ BEGIN
  CREATE TYPE public.project_stage_status AS ENUM ('not_started','in_progress','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_link_type AS ENUM ('drive','arquivo','referencia','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_access_role AS ENUM ('admin','editor','social_media','visualizador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('stage_completed','deadline_near','overdue','stalled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. tabelas
CREATE TABLE public.project_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  assigned_role public.app_role,
  assigned_to uuid,
  status public.project_stage_status NOT NULL DEFAULT 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  expected_duration_hours numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_stages_project ON public.project_stages(project_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;
GRANT ALL ON public.project_stages TO service_role;

CREATE TABLE public.project_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.project_access_role NOT NULL DEFAULT 'editor',
  can_edit boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_access TO authenticated;
GRANT ALL ON public.project_access TO service_role;

CREATE TABLE public.project_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.project_stages(id) ON DELETE SET NULL,
  title text NOT NULL,
  url text NOT NULL,
  type public.project_link_type NOT NULL DEFAULT 'outro',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_links_project ON public.project_links(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_links TO authenticated;
GRANT ALL ON public.project_links TO service_role;

CREATE TABLE public.project_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.project_stages(id) ON DELETE SET NULL,
  user_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_updates_project ON public.project_updates(project_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.project_updates TO authenticated;
GRANT ALL ON public.project_updates TO service_role;

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.project_stages(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 4. funcoes de acesso
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND public.can_access_client(_user_id, p.client_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access pa
      WHERE pa.project_id = _project_id AND pa.user_id = _user_id
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND public.can_edit_client(_user_id, p.client_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access pa
      WHERE pa.project_id = _project_id AND pa.user_id = _user_id
        AND pa.can_edit = true AND pa.role <> 'visualizador'
    );
$$;
REVOKE ALL ON FUNCTION public.can_edit_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated, service_role;

-- pode mexer na fase: admin, editor do cliente, ou membro com can_edit cujo papel bate com assigned_role
CREATE OR REPLACE FUNCTION public.can_edit_project_stage(_user_id uuid, _stage_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_stages s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = _stage_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR public.can_edit_client(_user_id, p.client_id)
        OR s.assigned_to = _user_id
        OR EXISTS (
          SELECT 1 FROM public.project_access pa
          WHERE pa.project_id = s.project_id
            AND pa.user_id = _user_id
            AND pa.can_edit = true
            AND pa.role <> 'visualizador'
            AND (
              s.assigned_role IS NULL
              OR s.assigned_role::text = pa.role::text
              OR pa.role = 'admin'
            )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_edit_project_stage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_project_stage(uuid, uuid) TO authenticated, service_role;

-- 5. RLS
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stages viewable by project members" ON public.project_stages FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Stages insertable by project editors" ON public.project_stages FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Stages updatable by responsible" ON public.project_stages FOR UPDATE TO authenticated
  USING (public.can_edit_project_stage(auth.uid(), id));
CREATE POLICY "Stages deletable by project editors" ON public.project_stages FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));

ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access viewable by project members" ON public.project_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Access managed by project editors" ON public.project_access FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Access updatable by project editors" ON public.project_access FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Access deletable by project editors" ON public.project_access FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));

ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Links viewable by project members" ON public.project_links FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Links insertable by project editors" ON public.project_links FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id) AND added_by = auth.uid());
CREATE POLICY "Links updatable by project editors" ON public.project_links FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Links deletable by project editors" ON public.project_links FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Updates viewable by project members" ON public.project_updates FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Updates insertable by project members" ON public.project_updates FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(auth.uid(), project_id) AND user_id = auth.uid());
CREATE POLICY "Updates deletable by project editors" ON public.project_updates FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications viewable by owner" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Notifications updatable by owner" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Notifications deletable by owner" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Notifications insertable by project editors" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (project_id IS NULL OR public.can_access_project(auth.uid(), project_id));

-- 6. triggers
CREATE TRIGGER update_project_stages_updated_at BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.project_stages_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  proj_name text;
  next_stage RECORD;
BEGIN
  IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    IF NEW.started_at IS NULL THEN NEW.started_at := COALESCE(OLD.started_at, now()); END IF;
    IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_stages_progress_trigger BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.project_stages_progress();

CREATE OR REPLACE FUNCTION public.project_stages_after_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  proj_name text;
  nxt public.project_stages;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    SELECT name INTO proj_name FROM public.projects WHERE id = NEW.project_id;

    -- libera proxima fase
    SELECT * INTO nxt FROM public.project_stages
    WHERE project_id = NEW.project_id AND order_index > NEW.order_index
    ORDER BY order_index ASC LIMIT 1;

    IF nxt.id IS NOT NULL AND nxt.status = 'not_started' THEN
      UPDATE public.project_stages
      SET status = 'in_progress', started_at = COALESCE(started_at, now())
      WHERE id = nxt.id;
    END IF;

    -- notifica admins
    INSERT INTO public.notifications (user_id, project_id, stage_id, type, title, message)
    SELECT ur.user_id, NEW.project_id, NEW.id, 'stage_completed',
           'Fase concluída: ' || NEW.name,
           COALESCE(proj_name, 'Projeto') || ' — fase "' || NEW.name || '" foi concluída.'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_stages_after_complete_trigger AFTER UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.project_stages_after_complete();