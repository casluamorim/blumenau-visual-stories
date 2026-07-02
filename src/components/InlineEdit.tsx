import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FieldType = 'text' | 'number' | 'date';

interface Props {
  value: string | number | null | undefined;
  table: 'invoices' | 'expenses' | 'quotes' | 'personal_income';
  id: string;
  field: string;
  type?: FieldType;
  disabled?: boolean;
  display?: React.ReactNode;
  className?: string;
  onSaved?: (newValue: any) => void;
  format?: (v: any) => string;
}

/**
 * Inline double-click editor. Click once = normal cell.
 * Double-click = edit inline. Enter/blur = save. Esc = cancel.
 */
export function InlineEdit({
  value, table, id, field, type = 'text', disabled, display, className, onSaved, format,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editing) {
      setDraft(
        type === 'date' && value
          ? String(value).slice(0, 10)
          : value == null ? '' : String(value)
      );
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [editing]);

  async function save() {
    if (saving) return;
    let newVal: any = draft;
    if (type === 'number') {
      newVal = draft === '' ? null : Number(String(draft).replace(',', '.'));
      if (newVal !== null && Number.isNaN(newVal)) {
        toast({ title: 'Valor inválido', variant: 'destructive' });
        return;
      }
    }
    if (type === 'date' && !draft) newVal = null;

    // No-op if unchanged
    const original = type === 'date' && value ? String(value).slice(0, 10) : value;
    if (String(newVal ?? '') === String(original ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from(table).update({ [field]: newVal } as any).eq('id', id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved?.(newVal);
    setEditing(false);
  }

  if (disabled) {
    return <span className={className}>{display ?? (format ? format(value) : (value ?? '—'))}</span>;
  }

  if (!editing) {
    return (
      <span
        className={`cursor-text hover:bg-muted/40 rounded px-1 -mx-1 ${className ?? ''}`}
        onDoubleClick={() => setEditing(true)}
        title="Duplo clique para editar"
      >
        {display ?? (format ? format(value) : (value ?? '—'))}
      </span>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      step={type === 'number' ? '0.01' : undefined}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
      }}
      className="h-7 text-sm"
      disabled={saving}
    />
  );
}
