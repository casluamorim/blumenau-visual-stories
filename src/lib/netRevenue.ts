/**
 * Cálculo de líquido de uma receita (fatura PJ ou receita PF):
 *   líquido = valor − imposto (%) − despesas vinculadas
 */
export type LinkedExpense = {
  id: string;
  amount: number | string;
  linked_invoice_id?: string | null;
  linked_income_id?: string | null;
};

export function taxAmount(amount: number | string, taxPercent: number | string | null | undefined) {
  const v = Number(amount) || 0;
  const p = Number(taxPercent) || 0;
  return (v * p) / 100;
}

/** Soma das despesas vinculadas a cada receita, indexada por id da receita. */
export function sumLinkedExpenses(
  expenses: LinkedExpense[],
  key: 'linked_invoice_id' | 'linked_income_id',
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const target = (e as any)[key] as string | null | undefined;
    if (!target) continue;
    map.set(target, (map.get(target) ?? 0) + (Number(e.amount) || 0));
  }
  return map;
}

export function netRevenue(
  amount: number | string,
  taxPercent: number | string | null | undefined,
  linkedExpensesTotal = 0,
) {
  const gross = Number(amount) || 0;
  return gross - taxAmount(gross, taxPercent) - (Number(linkedExpensesTotal) || 0);
}
