CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_full_name TEXT;
  invite_role public.app_role;
BEGIN
  SELECT ui.full_name, ui.role
  INTO invite_full_name, invite_role
  FROM public.user_invites ui
  WHERE lower(ui.email) = lower(NEW.email)
    AND ui.accepted_at IS NULL
    AND ui.expires_at > now()
  ORDER BY ui.created_at DESC
  LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(invite_full_name, COALESCE(NEW.raw_user_meta_data->>'full_name', '')),
    NEW.email,
    invite_role::text,
    true
  );

  IF invite_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.user_invites
    SET accepted_at = now(),
        accepted_by = NEW.id,
        updated_at = now()
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now();
  END IF;

  RETURN NEW;
END;
$$;