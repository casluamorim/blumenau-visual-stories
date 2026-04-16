
-- Create expense status enum
CREATE TYPE public.expense_status AS ENUM ('pending', 'paid', 'overdue');

-- Create financial type enum (PJ vs PF)
CREATE TYPE public.financial_type AS ENUM ('pj', 'pf');

-- Create recurrence type enum
CREATE TYPE public.recurrence_type AS ENUM ('one_time', 'recurring');

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  financial_type public.financial_type NOT NULL DEFAULT 'pj',
  due_date DATE NOT NULL,
  status public.expense_status NOT NULL DEFAULT 'pending',
  recurrence public.recurrence_type NOT NULL DEFAULT 'one_time',
  recurrence_day INTEGER,
  recurrence_end DATE,
  is_recurring_active BOOLEAN NOT NULL DEFAULT true,
  parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  attachment_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses manageable by authenticated"
ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expense tags junction
CREATE TABLE public.expense_tags (
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);

ALTER TABLE public.expense_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense tags manageable by authenticated"
ON public.expense_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add recurrence and project fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN recurrence public.recurrence_type NOT NULL DEFAULT 'one_time',
  ADD COLUMN recurrence_day INTEGER,
  ADD COLUMN recurrence_end DATE,
  ADD COLUMN is_recurring_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN parent_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN financial_type public.financial_type NOT NULL DEFAULT 'pj';

-- Add invoice_tags junction
CREATE TABLE public.invoice_tags (
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (invoice_id, tag_id)
);

ALTER TABLE public.invoice_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice tags manageable by authenticated"
ON public.invoice_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for expenses updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add PF income table (receitas pessoais)
CREATE TABLE public.personal_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  due_date DATE NOT NULL,
  status public.expense_status NOT NULL DEFAULT 'pending',
  recurrence public.recurrence_type NOT NULL DEFAULT 'one_time',
  recurrence_day INTEGER,
  recurrence_end DATE,
  is_recurring_active BOOLEAN NOT NULL DEFAULT true,
  parent_income_id UUID REFERENCES public.personal_income(id) ON DELETE SET NULL,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personal income manageable by authenticated"
ON public.personal_income FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_personal_income_updated_at
BEFORE UPDATE ON public.personal_income
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
