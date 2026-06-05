import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { listMonthsAround, monthKey, monthLabel, parseMonthKey } from '@/lib/financialMonthly';

interface Props {
  value: Date;
  onChange: (d: Date) => void;
  showFuture: boolean;
  onShowFutureChange: (v: boolean) => void;
}

export function MonthNavigator({ value, onChange, showFuture, onShowFutureChange }: Props) {
  const options = listMonthsAround(new Date(), 18, 12);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Mês anterior"
        className="text-foreground hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={monthKey(value)} onValueChange={(v) => onChange(parseMonthKey(v))}>
        <SelectTrigger className="w-[200px] border-border bg-background text-foreground font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {options.map((m) => (
            <SelectItem key={monthKey(m)} value={monthKey(m)}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(value, 1))}
        aria-label="Próximo mês"
        className="text-foreground hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(new Date())}
        className="ml-1 border-border bg-background text-foreground hover:bg-muted"
      >
        Hoje
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Switch id="show-future" checked={showFuture} onCheckedChange={onShowFutureChange} />
        <Label htmlFor="show-future" className="cursor-pointer text-xs text-muted-foreground">
          Mostrar lançamentos futuros
        </Label>
      </div>
    </div>
  );
}
