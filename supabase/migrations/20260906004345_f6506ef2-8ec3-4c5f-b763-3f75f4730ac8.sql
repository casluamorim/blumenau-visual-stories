CREATE TABLE public.invoice_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  mode text NOT NULL DEFAULT 'fixed',
  value numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_costs TO authenticated;
GRANT ALL ON public.invoice_costs TO service_role;

ALTER TABLE public.invoice_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view invoice costs" ON public.invoice_costs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert invoice costs" ON public.invoice_costs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update invoice costs" ON public.invoice_costs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team can delete invoice costs" ON public.invoice_costs
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_invoice_costs_invoice ON public.invoice_costs(invoice_id);

CREATE TRIGGER update_invoice_costs_updated_at
  BEFORE UPDATE ON public.invoice_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_plan text NOT NULL DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS installments integer,
  ADD COLUMN IF NOT EXISTS first_due_date date;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer;