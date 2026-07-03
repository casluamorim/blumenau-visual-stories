import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CC_CATEGORIES } from './CreditCardImport';

interface Props {
  table: 'expenses' | 'personal_income';
  id: string;
  value: string | null;
  disabled?: boolean;
  onSaved?: () => void;
}

export function InlineCategorySelect({ table, id, value, disabled, onSaved }: Props) {
  const { toast } = useToast();
  if (disabled) return <span className="text-muted-foreground text-sm">{value ?? '—'}</span>;

  return (
    <Select
      value={value ?? ''}
      onValueChange={async (v) => {
        const { error } = await (supabase.from(table) as any).update({ category: v }).eq('id', id);
        if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
        onSaved?.();
      }}
    >
      <SelectTrigger className="h-7 text-xs border-transparent hover:border-border bg-transparent">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
