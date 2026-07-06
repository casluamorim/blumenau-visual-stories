import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Trash2, Plus, ArrowRightLeft } from 'lucide-react';
import { InlineEdit } from '@/components/InlineEdit';
import { InlineCategorySelect } from './InlineCategorySelect';
import { CC_CATEGORIES } from './CreditCardImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ChildExpense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  due_date: string;
  parent_expense_id: string | null;
  financial_type?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parentId: string;
  parentTitle: string;
  /** Deprecated: dialog now fetches its own children. Kept for backwards compat. */
  children?: ChildExpense[];
  onChanged: () => void;
}

export function CardExpenseDialog({ open, onOpenChange, parentId, parentTitle, onChanged }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const [items, setItems] = useState<ChildExpense[]>([]);
  const [financialType, setFinancialType] = useState<string>('pf');
  const [otherInvoices, setOtherInvoices] = useState<{ id: string; description: string; due_date: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // manual-add form
  const [addOpen, setAddOpen] = useState(false);
  const [nDesc, setNDesc] = useState('');
  const [nAmount, setNAmount] = useState('');
  const [nCategory, setNCategory] = useState('Outros');
  const [nDate, setNDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const total = useMemo(() => items.reduce((a, c) => a + Number(c.amount || 0), 0), [items]);

  const load = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    const [{ data: parent }, { data: children }] = await Promise.all([
      supabase.from('expenses').select('id, financial_type, due_date').eq('id', parentId).maybeSingle(),
      supabase.from('expenses').select('id, description, amount, category, due_date, parent_expense_id, financial_type')
        .eq('parent_expense_id', parentId).order('due_date', { ascending: false }),
    ]);
    const ft = (parent as any)?.financial_type ?? 'pf';
    setFinancialType(ft);
    setItems((children as any[]) ?? []);
    // Other card invoices to allow "move" action
    const { data: others } = await (supabase.from('expenses') as any)
      .select('id, description, due_date')
      .eq('category', 'Cartão de Crédito')
      .is('parent_expense_id', null)
      .eq('financial_type', ft)
      .neq('id', parentId)
      .order('due_date', { ascending: false })
      .limit(30);
    setOtherInvoices((others as any[]) ?? []);
    setLoading(false);
  }, [parentId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function syncParentTotal(rows: ChildExpense[]) {
    const sum = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
    await (supabase.from('expenses') as any).update({ amount: sum }).eq('id', parentId);
    onChanged();
  }

  async function refreshAndSync() {
    const { data } = await supabase.from('expenses')
      .select('id, description, amount, category, due_date, parent_expense_id, financial_type')
      .eq('parent_expense_id', parentId).order('due_date', { ascending: false });
    const next = (data as any[]) ?? [];
    setItems(next);
    await syncParentTotal(next);
  }

  async function deleteChild(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await refreshAndSync();
  }

  async function moveChild(id: string, newParentId: string) {
    if (!newParentId || newParentId === parentId) return;
    const { error } = await (supabase.from('expenses') as any)
      .update({ parent_expense_id: newParentId }).eq('id', id);
    if (error) { toast({ title: 'Erro ao mover', description: error.message, variant: 'destructive' }); return; }
    // Recalc both invoices
    const { data: newSiblings } = await supabase.from('expenses').select('amount').eq('parent_expense_id', newParentId);
    const newTotal = (newSiblings as any[] ?? []).reduce((a, r) => a + Number(r.amount || 0), 0);
    await (supabase.from('expenses') as any).update({ amount: newTotal }).eq('id', newParentId);
    toast({ title: 'Item movido para outra fatura' });
    await refreshAndSync();
  }

  async function addManualItem() {
    const amt = Number(String(nAmount).replace(',', '.'));
    if (!nDesc.trim() || !Number.isFinite(amt) || amt <= 0 || !nDate) {
      toast({ title: 'Preencha descrição, valor e data', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase.from('expenses') as any).insert({
      description: nDesc.trim(),
      amount: amt,
      category: nCategory,
      due_date: nDate,
      status: 'paid',
      financial_type: financialType,
      recurrence: 'one_time',
      parent_expense_id: parentId,
      notes: '[Item de fatura]',
      created_by: user?.id,
    });
    if (error) { toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' }); return; }
    setNDesc(''); setNAmount(''); setNCategory('Outros');
    setAddOpen(false);
    await refreshAndSync();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {parentTitle}
            <span className="ml-auto text-sm text-muted-foreground font-normal">
              {items.length} itens • Total: <span className="text-foreground font-semibold">{fmt(total)}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Duplo clique em qualquer campo para editar. Alterações atualizam o total automaticamente.
          </div>
          <Button size="sm" onClick={() => setAddOpen(o => !o)}>
            <Plus className="h-4 w-4 mr-1" /> {addOpen ? 'Fechar' : 'Adicionar item'}
          </Button>
        </div>

        {addOpen && (
          <div className="rounded-lg border border-border p-3 bg-muted/20 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="Ex: Uber" />
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input type="number" step="0.01" value={nAmount} onChange={e => setNAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={nDate} onChange={e => setNDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={nCategory} onValueChange={setNCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {CC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button size="sm" onClick={addManualItem}>Adicionar à fatura</Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Nenhum item nesta fatura. Use "Adicionar item" acima.'}
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-52">Categoria</TableHead>
                  <TableHead className="text-right w-32">Valor</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      <InlineEdit table="expenses" id={c.id} field="due_date" value={c.due_date} type="date"
                        format={(v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'} onSaved={refreshAndSync} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <InlineEdit table="expenses" id={c.id} field="description" value={c.description} onSaved={refreshAndSync} />
                    </TableCell>
                    <TableCell>
                      <InlineCategorySelect table="expenses" id={c.id} value={c.category} onSaved={refreshAndSync} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      <InlineEdit table="expenses" id={c.id} field="amount" value={c.amount} type="number"
                        format={(v) => fmt(Number(v))} onSaved={refreshAndSync} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {otherInvoices.length > 0 && (
                          <Select value="" onValueChange={(v) => moveChild(c.id, v)}>
                            <SelectTrigger className="h-7 w-8 p-0 border-none bg-transparent" title="Mover para outra fatura">
                              <ArrowRightLeft className="h-4 w-4 mx-auto text-muted-foreground" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherInvoices.map(inv => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  {inv.description} ({new Date(inv.due_date).toLocaleDateString('pt-BR')})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteChild(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
