
-- Client access tokens for portal
CREATE TABLE public.client_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_access_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage tokens
CREATE POLICY "Tokens manageable by authenticated" ON public.client_access_tokens
  FOR ALL TO authenticated USING (true);

-- Anonymous/public can read active tokens (for portal access)
CREATE POLICY "Active tokens readable by anyone" ON public.client_access_tokens
  FOR SELECT TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Allow anon to read clients via token
CREATE POLICY "Clients viewable via portal" ON public.clients
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.client_access_tokens
      WHERE client_access_tokens.client_id = clients.id
        AND client_access_tokens.is_active = true
        AND (client_access_tokens.expires_at IS NULL OR client_access_tokens.expires_at > now())
    )
  );

-- Allow anon to read projects via portal
CREATE POLICY "Projects viewable via portal" ON public.projects
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.client_access_tokens
      WHERE client_access_tokens.client_id = projects.client_id
        AND client_access_tokens.is_active = true
        AND (client_access_tokens.expires_at IS NULL OR client_access_tokens.expires_at > now())
    )
  );

-- Allow anon to read contents via portal
CREATE POLICY "Contents viewable via portal" ON public.contents
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.client_access_tokens cat
      JOIN public.projects p ON p.id = contents.project_id
      WHERE cat.client_id = p.client_id
        AND cat.is_active = true
        AND (cat.expires_at IS NULL OR cat.expires_at > now())
    )
  );

-- Allow anon to update content status (for approvals)
CREATE POLICY "Contents approvable via portal" ON public.contents
  FOR UPDATE TO anon USING (
    EXISTS (
      SELECT 1 FROM public.client_access_tokens cat
      JOIN public.projects p ON p.id = contents.project_id
      WHERE cat.client_id = p.client_id
        AND cat.is_active = true
        AND (cat.expires_at IS NULL OR cat.expires_at > now())
    )
  );

-- Allow anon to read content versions via portal
CREATE POLICY "Versions viewable via portal" ON public.content_versions
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.contents c
      JOIN public.projects p ON p.id = c.project_id
      JOIN public.client_access_tokens cat ON cat.client_id = p.client_id
      WHERE c.id = content_versions.content_id
        AND cat.is_active = true
        AND (cat.expires_at IS NULL OR cat.expires_at > now())
    )
  );

-- Allow anon to insert comments via portal
CREATE POLICY "Comments insertable via portal" ON public.comments
  FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      JOIN public.contents c ON c.id = cv.content_id
      JOIN public.projects p ON p.id = c.project_id
      JOIN public.client_access_tokens cat ON cat.client_id = p.client_id
      WHERE cv.id = comments.content_version_id
        AND cat.is_active = true
        AND (cat.expires_at IS NULL OR cat.expires_at > now())
    )
  );

-- Allow anon to read comments via portal
CREATE POLICY "Comments viewable via portal" ON public.comments
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      JOIN public.contents c ON c.id = cv.content_id
      JOIN public.projects p ON p.id = c.project_id
      JOIN public.client_access_tokens cat ON cat.client_id = p.client_id
      WHERE cv.id = comments.content_version_id
        AND cat.is_active = true
        AND (cat.expires_at IS NULL OR cat.expires_at > now())
    )
  );

CREATE INDEX idx_client_access_tokens_token ON public.client_access_tokens(token);
CREATE INDEX idx_client_access_tokens_client ON public.client_access_tokens(client_id);
