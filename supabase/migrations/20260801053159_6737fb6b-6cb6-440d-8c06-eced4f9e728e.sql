ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS billing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS billing_due_day integer,
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS billing_description text,
  ADD COLUMN IF NOT EXISTS billing_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS billing_last_generated_month text;

CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  asaas_payment_id text NOT NULL UNIQUE,
  description text,
  amount numeric(12,2) NOT NULL,
  billing_type text NOT NULL DEFAULT 'PIX',
  status text NOT NULL DEFAULT 'PENDING',
  due_date date NOT NULL,
  invoice_url text,
  pix_payload text,
  pix_qr_code text,
  paid_at timestamp with time zone,
  competence_month text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_charges TO authenticated;
GRANT ALL ON public.asaas_charges TO service_role;

ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view charges of accessible clients"
ON public.asaas_charges FOR SELECT TO authenticated
USING (public.can_access_client(auth.uid(), client_id));

CREATE POLICY "Team can insert charges for editable clients"
ON public.asaas_charges FOR INSERT TO authenticated
WITH CHECK (public.can_edit_client(auth.uid(), client_id));

CREATE POLICY "Team can update charges for editable clients"
ON public.asaas_charges FOR UPDATE TO authenticated
USING (public.can_edit_client(auth.uid(), client_id))
WITH CHECK (public.can_edit_client(auth.uid(), client_id));

CREATE POLICY "Admins can delete charges"
ON public.asaas_charges FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS asaas_charges_client_idx ON public.asaas_charges (client_id, due_date DESC);

CREATE TRIGGER update_asaas_charges_updated_at
BEFORE UPDATE ON public.asaas_charges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();