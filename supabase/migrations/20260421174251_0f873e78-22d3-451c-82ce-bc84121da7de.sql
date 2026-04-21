-- Profiles: gestão de usuários
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_token_idx ON public.profiles(invite_token) WHERE invite_token IS NOT NULL;

-- Clientes: dono
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by uuid;

-- Tabela client_assignments
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_level text NOT NULL DEFAULT 'edit' CHECK (access_level IN ('view', 'edit', 'admin')),
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS client_assignments_user_idx ON public.client_assignments(user_id);
CREATE INDEX IF NOT EXISTS client_assignments_client_idx ON public.client_assignments(client_id);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.client_assignments WHERE client_id = _client_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.client_assignments
      WHERE client_id = _client_id AND user_id = _user_id
        AND access_level IN ('edit', 'admin')
    );
$$;

-- RLS client_assignments
DROP POLICY IF EXISTS "Assignments viewable" ON public.client_assignments;
CREATE POLICY "Assignments viewable"
ON public.client_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Assignments manageable" ON public.client_assignments;
CREATE POLICY "Assignments manageable"
ON public.client_assignments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND created_by = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND created_by = auth.uid())
);

-- RLS clients
DROP POLICY IF EXISTS "Clients viewable by authenticated" ON public.clients;
DROP POLICY IF EXISTS "Clients manageable by authenticated" ON public.clients;
DROP POLICY IF EXISTS "Clients updatable by authenticated" ON public.clients;
DROP POLICY IF EXISTS "Clients deletable by authenticated" ON public.clients;

CREATE POLICY "Clients viewable by linked"
ON public.clients FOR SELECT TO authenticated
USING (public.can_access_client(auth.uid(), id));

CREATE POLICY "Clients insertable"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Clients updatable by editors"
ON public.clients FOR UPDATE TO authenticated
USING (public.can_edit_client(auth.uid(), id));

CREATE POLICY "Clients deletable by admin or owner"
ON public.clients FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

-- RLS invoices
DROP POLICY IF EXISTS "Invoices manageable by authenticated" ON public.invoices;

CREATE POLICY "Invoices viewable"
ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
  OR public.can_access_client(auth.uid(), client_id)
);

CREATE POLICY "Invoices insertable"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Invoices updatable"
ON public.invoices FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
);

CREATE POLICY "Invoices deletable"
ON public.invoices FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
);

-- RLS expenses
DROP POLICY IF EXISTS "Expenses manageable by authenticated" ON public.expenses;

CREATE POLICY "Expenses viewable"
ON public.expenses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
  OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
);

CREATE POLICY "Expenses insertable"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Expenses updatable"
ON public.expenses FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
);

CREATE POLICY "Expenses deletable"
ON public.expenses FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR created_by = auth.uid()
);

-- RLS personal_income (sempre privado)
DROP POLICY IF EXISTS "Personal income manageable by authenticated" ON public.personal_income;

CREATE POLICY "Personal income viewable by owner"
ON public.personal_income FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Personal income insertable by owner"
ON public.personal_income FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Personal income updatable by owner"
ON public.personal_income FOR UPDATE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Personal income deletable by owner"
ON public.personal_income FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- RLS projects
DROP POLICY IF EXISTS "Projects viewable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects manageable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects updatable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects deletable by authenticated" ON public.projects;

CREATE POLICY "Projects viewable by linked"
ON public.projects FOR SELECT TO authenticated
USING (public.can_access_client(auth.uid(), client_id));

CREATE POLICY "Projects insertable by editors"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.can_edit_client(auth.uid(), client_id));

CREATE POLICY "Projects updatable by editors"
ON public.projects FOR UPDATE TO authenticated
USING (public.can_edit_client(auth.uid(), client_id));

CREATE POLICY "Projects deletable by editors"
ON public.projects FOR DELETE TO authenticated
USING (public.can_edit_client(auth.uid(), client_id));

-- RLS contents
DROP POLICY IF EXISTS "Contents viewable by authenticated" ON public.contents;
DROP POLICY IF EXISTS "Contents manageable by authenticated" ON public.contents;
DROP POLICY IF EXISTS "Contents updatable by authenticated" ON public.contents;
DROP POLICY IF EXISTS "Contents deletable by authenticated" ON public.contents;

CREATE POLICY "Contents viewable by linked"
ON public.contents FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contents.project_id AND public.can_access_client(auth.uid(), p.client_id))
);

CREATE POLICY "Contents insertable by editors"
ON public.contents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contents.project_id AND public.can_edit_client(auth.uid(), p.client_id))
);

CREATE POLICY "Contents updatable by editors"
ON public.contents FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contents.project_id AND public.can_edit_client(auth.uid(), p.client_id))
);

CREATE POLICY "Contents deletable by editors"
ON public.contents FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contents.project_id AND public.can_edit_client(auth.uid(), p.client_id))
);

-- Profiles: admin pode atualizar qualquer profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Profile readable por invite_token (anon)
DROP POLICY IF EXISTS "Profile readable by invite token" ON public.profiles;
CREATE POLICY "Profile readable by invite token"
ON public.profiles FOR SELECT TO anon
USING (invite_token IS NOT NULL AND invite_expires_at > now());