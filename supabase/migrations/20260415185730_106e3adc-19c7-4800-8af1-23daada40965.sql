
-- Quote status enum
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- Invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- Payment method enum
CREATE TYPE public.payment_method AS ENUM ('pix', 'bank_transfer', 'credit_card', 'boleto', 'other');

-- Quotes table (orçamentos)
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  status quote_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quotes manageable by authenticated" ON public.quotes FOR ALL TO authenticated USING (true);

CREATE POLICY "Quotes viewable via portal" ON public.quotes FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1 FROM public.client_access_tokens cat
    WHERE cat.client_id = quotes.client_id
      AND cat.is_active = true
      AND (cat.expires_at IS NULL OR cat.expires_at > now())
  )
);

-- Invoices table (faturas)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method payment_method,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices manageable by authenticated" ON public.invoices FOR ALL TO authenticated USING (true);

CREATE POLICY "Invoices viewable via portal" ON public.invoices FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1 FROM public.client_access_tokens cat
    WHERE cat.client_id = invoices.client_id
      AND cat.is_active = true
      AND (cat.expires_at IS NULL OR cat.expires_at > now())
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_quotes_client ON public.quotes(client_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
