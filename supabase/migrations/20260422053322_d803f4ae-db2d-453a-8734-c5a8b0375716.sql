CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_invites_email_token_key UNIQUE (email, token)
);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invites"
ON public.user_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create invites"
ON public.user_invites
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update invites"
ON public.user_invites
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete invites"
ON public.user_invites
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Public can read valid invite by token"
ON public.user_invites
FOR SELECT
TO anon
USING (accepted_at IS NULL AND expires_at > now());

CREATE TRIGGER update_user_invites_updated_at
BEFORE UPDATE ON public.user_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();