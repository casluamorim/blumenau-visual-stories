
DROP POLICY IF EXISTS "Portal actions can create notifications" ON public.client_notifications;

CREATE POLICY "Portal actions can create notifications"
  ON public.client_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (content_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.contents c WHERE c.id = content_id))
    OR (client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = client_id))
  );
