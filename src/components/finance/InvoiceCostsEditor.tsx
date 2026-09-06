import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { costAmount, costKindLabels, totalCosts, type CostKind, type CostMode, type InvoiceCost } from '@/lib/invoiceCosts';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  gross: number;
  costs: InvoiceCost[];
  onChange: (costs: InvoiceCost[]) => void;
}

export function InvoiceCostsEditor({ gross, costs, onChange }: Props) {
  function update(i: number, patch: Partial<InvoiceCost>) {
    const arr = [...costs];
    arr[i] = { ...arr[i], ...patch };
    onChange(arr);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Custos deste trabalho</Label>
        <span className="text-xs text-muted-foreground">Total: {fmt(totalCosts(costs, gross))}</span>
      </div>

      {costs.map((c, i) => (
        <div key={c.id ?? i} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <Input placeholder="Ex: Editor freelancer" value={c.description}
              onChange={e => update(i, { description: e.target.value })} />
          </div>
          <Select value={c.kind} onValueChange={(v) => update(i, { kind: v as CostKind })}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(costKindLabels) as CostKind[]).map(k => (
                <SelectItem key={k} value={k}>{costKindLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={c.mode} onValueChange={(v) => update(i, { mode: v as CostMode })}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">R$</SelectItem>
              <SelectItem value="percent">%</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-24">
            <Input type="number" step="0.01" min="0" value={c.value || ''}
              onChange={e => update(i, { value: Number(e.target.value) })} />
          </div>
          <div className="w-24 text-right text-xs text-destructive whitespace-nowrap pb-2">
            −{fmt(costAmount(c, gross))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onChange(costs.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm"
        onClick={() => onChange([...costs, { description: '', kind: 'freelancer', mode: 'fixed', value: 0 }])}>
        <Plus className="mr-1 h-3 w-3" /> Adicionar custo
      </Button>
      <p className="text-xs text-muted-foreground">
        Use % para comissão da agência que contratou. O líquido já desconta imposto e todos estes custos.
      </p>
    </div>
  );
}
