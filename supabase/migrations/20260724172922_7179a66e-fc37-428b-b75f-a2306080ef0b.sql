
CREATE TABLE public.client_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  content_id uuid REFERENCES public.contents(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  message text,
  author_name text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notifications_created ON public.client_notifications(created_at DESC);
CREATE INDEX idx_client_notifications_unread ON public.client_notifications(read_at) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notifications TO authenticated;
GRANT INSERT ON public.client_notifications TO anon;
GRANT ALL ON public.client_notifications TO service_role;

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone (portal by token, authenticated client, team) can insert a notification event
CREATE POLICY "Portal actions can create notifications"
  ON public.client_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only team members (non-client authenticated users) can view/update notifications
CREATE POLICY "Team can view notifications"
  ON public.client_notifications FOR SELECT
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'client'::app_role));

CREATE POLICY "Team can update notifications"
  ON public.client_notifications FOR UPDATE
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'client'::app_role));

CREATE POLICY "Team can delete notifications"
  ON public.client_notifications FOR DELETE
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'client'::app_role));
