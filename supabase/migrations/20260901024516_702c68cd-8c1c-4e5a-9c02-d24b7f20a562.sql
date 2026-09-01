ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_trigger text,
  ADD COLUMN IF NOT EXISTS payment_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_amount numeric;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_payment_trigger_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_payment_trigger_check
  CHECK (payment_trigger IS NULL OR payment_trigger IN ('scheduled', 'on_delivery'));

CREATE INDEX IF NOT EXISTS projects_quote_id_idx ON public.projects(quote_id);