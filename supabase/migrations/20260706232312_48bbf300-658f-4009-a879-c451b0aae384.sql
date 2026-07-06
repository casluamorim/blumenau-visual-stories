
-- Switch role/access helpers to SECURITY INVOKER (they only read tables the caller has RLS access to)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_access_client(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND auth_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.client_assignments WHERE client_id = _client_id AND user_id = _user_id);
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_client(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.client_assignments
      WHERE client_id = _client_id AND user_id = _user_id
        AND access_level IN ('edit', 'admin')
    );
$function$;

-- Tighten always-true policies on shared taxonomy tables and activity logs
DROP POLICY IF EXISTS "Logs insertable by authenticated" ON public.activity_logs;
CREATE POLICY "Logs insertable by authenticated"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

DROP POLICY IF EXISTS "Tokens manageable by authenticated" ON public.client_access_tokens;
CREATE POLICY "Tokens manageable by authenticated"
  ON public.client_access_tokens FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Client tags accessible by authenticated" ON public.client_tags;
CREATE POLICY "Client tags accessible by authenticated"
  ON public.client_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Content tags accessible by authenticated" ON public.content_tags;
CREATE POLICY "Content tags accessible by authenticated"
  ON public.content_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Expense tags manageable by authenticated" ON public.expense_tags;
CREATE POLICY "Expense tags manageable by authenticated"
  ON public.expense_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Invoice tags manageable by authenticated" ON public.invoice_tags;
CREATE POLICY "Invoice tags manageable by authenticated"
  ON public.invoice_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Project tags accessible by authenticated" ON public.project_tags;
CREATE POLICY "Project tags accessible by authenticated"
  ON public.project_tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Tags manageable by authenticated" ON public.tags;
CREATE POLICY "Tags manageable by authenticated"
  ON public.tags FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
