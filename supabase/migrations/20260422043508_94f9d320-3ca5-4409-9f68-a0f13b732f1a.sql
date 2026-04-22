-- Allow admins to insert invite placeholder profiles (where user_id != auth.uid())
CREATE POLICY "Admins can insert invite profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND invite_token IS NOT NULL
);

-- Allow admins to delete profiles (used to clean up placeholder after invite is accepted, or remove users)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert roles for any user (needed to assign role on invite acceptance/management)
CREATE POLICY "Admins can manage user_roles insert"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user_roles delete"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow the new user (during invite acceptance) to insert their own role
CREATE POLICY "Users can insert own role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
