
-- Separate media/copy approval and per-item comments
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS copy_status text NOT NULL DEFAULT 'pending';

-- Comments anchored to a content (general/media/copy)
CREATE TABLE IF NOT EXISTS public.content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL,
  target text NOT NULL DEFAULT 'general', -- general | media | copy
  author_name text,
  author_user_id uuid,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_comments_content ON public.content_comments(content_id);

ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated team
CREATE POLICY "content_comments select auth"
  ON public.content_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "content_comments insert auth"
  ON public.content_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "content_comments delete own"
  ON public.content_comments FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Anon portal (via valid client token)
CREATE POLICY "content_comments select via portal"
  ON public.content_comments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM contents c
    JOIN projects p ON p.id = c.project_id
    JOIN client_access_tokens cat ON cat.client_id = p.client_id
    WHERE c.id = content_comments.content_id
      AND cat.is_active = true
      AND (cat.expires_at IS NULL OR cat.expires_at > now())
  ));

CREATE POLICY "content_comments insert via portal"
  ON public.content_comments FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM contents c
    JOIN projects p ON p.id = c.project_id
    JOIN client_access_tokens cat ON cat.client_id = p.client_id
    WHERE c.id = content_comments.content_id
      AND cat.is_active = true
      AND (cat.expires_at IS NULL OR cat.expires_at > now())
  ));
