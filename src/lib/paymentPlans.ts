/**
 * Formas de pagamento de uma proposta: total, 50/50, semanal ou mensal.
 * Ao aprovar a proposta, geramos uma fatura por parcela.
 */
export type PaymentPlan = 'total' | '50_50' | 'weekly' | 'monthly';

export const paymentPlanLabels: Record<PaymentPlan, string> = {
  total: 'Valor total (à vista)',
  '50_50': '50% + 50%',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export function defaultInstallments(plan: PaymentPlan) {
  if (plan === 'total') return 1;
  if (plan === '50_50') return 2;
  return 4;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export interface Installment {
  number: number;
  total: number;
  amount: number;
  dueDate: string;
}

/** Divide o valor cheio em parcelas com datas, sem perder centavos. */
export function buildInstallments(
  plan: PaymentPlan,
  totalValue: number,
  firstDueDate: string,
  installments?: number | null,
): Installment[] {
  const total = plan === 'total' ? 1 : plan === '50_50' ? 2 : Math.max(1, Number(installments) || defaultInstallments(plan));
  const gross = Number(totalValue) || 0;
  const base = Math.round((gross / total) * 100) / 100;
  const out: Installment[] = [];
  let acc = 0;
  for (let i = 0; i < total; i++) {
    const last = i === total - 1;
    const amount = last ? Math.round((gross - acc) * 100) / 100 : base;
    acc += amount;
    const dueDate =
      i === 0 ? firstDueDate
        : plan === 'weekly' ? addDays(firstDueDate, 7 * i)
        : addMonths(firstDueDate, i);
    out.push({ number: i + 1, total, amount, dueDate });
  }
  return out;
}

export function planSummary(plan: PaymentPlan, totalValue: number, installments?: number | null) {
  const parcels = buildInstallments(plan, totalValue, new Date().toISOString().slice(0, 10), installments);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (parcels.length === 1) return `1 fatura de ${fmt(parcels[0].amount)}`;
  return `${parcels.length} faturas de ${fmt(parcels[0].amount)}`;
}
