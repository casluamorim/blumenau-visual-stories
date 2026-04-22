DROP POLICY IF EXISTS "Public can read valid invite by token" ON public.user_invites;

CREATE OR REPLACE FUNCTION public.get_user_invite_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role public.app_role,
  token TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ui.id, ui.full_name, ui.email, ui.role, ui.token, ui.expires_at
  FROM public.user_invites ui
  WHERE ui.token = _token
    AND ui.accepted_at IS NULL
    AND ui.expires_at > now()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_user_invite_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_user_invite_accepted(_token TEXT, _accepted_by UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_invites
  SET accepted_at = now(),
      accepted_by = _accepted_by,
      updated_at = now()
  WHERE token = _token
    AND accepted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_user_invite_accepted(TEXT, UUID) TO authenticated;