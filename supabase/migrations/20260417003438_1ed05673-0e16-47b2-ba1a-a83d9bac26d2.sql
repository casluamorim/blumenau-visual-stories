-- Settings table (singleton row)
CREATE TABLE public.agency_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_name TEXT NOT NULL DEFAULT 'Racun OS',
  agency_logo_url TEXT,
  agency_phone TEXT,
  agency_email TEXT,
  agency_document TEXT,
  default_pix_key TEXT,
  default_pix_key_type TEXT DEFAULT 'cnpj',
  whatsapp_template TEXT NOT NULL DEFAULT 'Olá {empresa}! 👋

Passando para lembrar da fatura:

💰 Valor: {valor}
📅 Vencimento: {vencimento}

🔑 Chave Pix: {pix}

Qualquer dúvida, é só chamar!',
  invoice_prefix TEXT NOT NULL DEFAULT 'FAT',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  default_revision_limit INTEGER NOT NULL DEFAULT 3,
  default_invoice_due_days INTEGER NOT NULL DEFAULT 7,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for WhatsApp template, pix, etc.)
CREATE POLICY "Settings readable by authenticated"
  ON public.agency_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Settings insertable by admin"
  ON public.agency_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Settings updatable by admin"
  ON public.agency_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Settings deletable by admin"
  ON public.agency_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated at trigger
CREATE TRIGGER update_agency_settings_updated_at
  BEFORE UPDATE ON public.agency_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default singleton row
INSERT INTO public.agency_settings (agency_name) VALUES ('Racun OS');

-- Storage bucket for agency logo
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-assets', 'agency-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agency assets publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agency-assets');

CREATE POLICY "Authenticated can upload agency assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agency-assets');

CREATE POLICY "Authenticated can update agency assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agency-assets');

CREATE POLICY "Authenticated can delete agency assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agency-assets');