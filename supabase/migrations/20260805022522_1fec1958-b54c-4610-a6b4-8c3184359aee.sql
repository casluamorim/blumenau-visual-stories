ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS asaas_account_1_label text,
  ADD COLUMN IF NOT EXISTS asaas_account_1_cnpj text,
  ADD COLUMN IF NOT EXISTS asaas_account_2_label text,
  ADD COLUMN IF NOT EXISTS asaas_account_2_cnpj text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS asaas_account text NOT NULL DEFAULT '1';

ALTER TABLE public.clients
  ADD CONSTRAINT clients_asaas_account_check CHECK (asaas_account IN ('1','2'));

ALTER TABLE public.asaas_charges
  ADD COLUMN IF NOT EXISTS asaas_account text NOT NULL DEFAULT '1';