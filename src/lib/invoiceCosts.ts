/**
 * Custos lançados dentro da própria fatura (freelancers, % da agência parceira, outros).
 * Assim não é preciso criar uma despesa separada para cada custo do trabalho.
 */
import { supabase } from '@/integrations/supabase/client';

export type CostKind = 'freelancer' | 'agency' | 'other';
export type CostMode = 'fixed' | 'percent';

export interface InvoiceCost {
  id?: string;
  invoice_id?: string;
  description: string;
  kind: CostKind;
  mode: CostMode;
  value: number;
}

export const costKindLabels: Record<CostKind, string> = {
  freelancer: 'Freelancer',
  agency: 'Comissão de agência',
  other: 'Outro custo',
};

/** Valor em reais de um custo, considerando o valor bruto da fatura. */
export function costAmount(cost: Pick<InvoiceCost, 'mode' | 'value'>, gross: number | string) {
  const g = Number(gross) || 0;
  const v = Number(cost.value) || 0;
  return cost.mode === 'percent' ? (g * v) / 100 : v;
}

export function totalCosts(costs: Pick<InvoiceCost, 'mode' | 'value'>[], gross: number | string) {
  return costs.reduce((a, c) => a + costAmount(c, gross), 0);
}

/** Agrupa custos por fatura, já convertidos em reais. */
export function sumCostsByInvoice(
  costs: (InvoiceCost & { invoice_id: string })[],
  invoiceAmounts: Map<string, number>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of costs) {
    const gross = invoiceAmounts.get(c.invoice_id) ?? 0;
    map.set(c.invoice_id, (map.get(c.invoice_id) ?? 0) + costAmount(c, gross));
  }
  return map;
}

/** Substitui todos os custos de uma fatura pelos informados. */
export async function saveInvoiceCosts(invoiceId: string, costs: InvoiceCost[], userId?: string) {
  const clean = costs.filter(c => c.description.trim() && Number(c.value) > 0);
  const { error: delErr } = await supabase.from('invoice_costs').delete().eq('invoice_id', invoiceId);
  if (delErr) return { error: delErr };
  if (!clean.length) return { error: null };
  const { error } = await supabase.from('invoice_costs').insert(
    clean.map(c => ({
      invoice_id: invoiceId,
      description: c.description.trim(),
      kind: c.kind,
      mode: c.mode,
      value: Number(c.value) || 0,
      created_by: userId ?? null,
    })) as any,
  );
  return { error };
}

export async function loadInvoiceCosts(invoiceId: string): Promise<InvoiceCost[]> {
  const { data } = await supabase
    .from('invoice_costs')
    .select('id, invoice_id, description, kind, mode, value')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  return ((data as any[]) ?? []) as InvoiceCost[];
}
