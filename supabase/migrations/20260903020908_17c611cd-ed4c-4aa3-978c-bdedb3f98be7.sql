ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asaas_account text,
  ADD COLUMN IF NOT EXISTS cnpj text;

ALTER TABLE public.personal_income
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_income_id uuid REFERENCES public.personal_income(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_linked_invoice_id_idx ON public.expenses(linked_invoice_id);
CREATE INDEX IF NOT EXISTS expenses_linked_income_id_idx ON public.expenses(linked_income_id);