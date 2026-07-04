import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Trash2 } from 'lucide-react';
import { InlineEdit } from '@/components/InlineEdit';
import { InlineCategorySelect } from './InlineCategorySelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChildExpense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  due_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parentId: string;
  parentTitle: string;
  children: ChildExpense[];
  onChanged: () => void;
}

export function CardExpenseDialog({ open, onOpenChange, parentId, parentTitle, children, onChanged }: Props) {
  const { toast } = useToast();
  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const total = useMemo(() => children.reduce((a, c) => a + Number(c.amount || 0), 0), [children]);

  async function refreshParentTotal() {
    await (supabase.from('expenses') as any).update({ amount: total }).eq('id', parentId);
    onChanged();
  }

  async function deleteChild(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    // Recompute parent total from remaining
    const remaining = children.filter(c => c.id !== id).reduce((a, c) => a + Number(c.amount || 0), 0);
    await (supabase.from('expenses') as any).update({ amount: remaining }).eq('id', parentId);
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {parentTitle}
            <span className="ml-auto text-sm text-muted-foreground font-normal">
              {children.length} itens • Total: <span className="text-foreground font-semibold">{fmt(total)}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {children.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum item nesta fatura.</div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-52">Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      <InlineEdit table="expenses" id={c.id} field="due_date" value={c.due_date} type="date"
                        format={(v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'} onSaved={onChanged} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <InlineEdit table="expenses" id={c.id} field="description" value={c.description} onSaved={onChanged} />
                    </TableCell>
                    <TableCell>
                      <InlineCategorySelect table="expenses" id={c.id} value={c.category} onSaved={onChanged} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      <InlineEdit table="expenses" id={c.id} field="amount" value={c.amount} type="number"
                        format={(v) => fmt(Number(v))} onSaved={onChanged} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteChild(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={refreshParentTotal}>Atualizar total da fatura</Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
