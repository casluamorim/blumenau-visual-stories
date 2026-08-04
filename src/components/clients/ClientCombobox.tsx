import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ComboClient {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  clients?: ComboClient[];
  onClientCreated?: (client: ComboClient) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  allowCreate?: boolean;
  className?: string;
  disabled?: boolean;
}

function label(c: ComboClient) {
  return c.company ? `${c.company} — ${c.name}` : c.name;
}

export function ClientCombobox({
  value,
  onChange,
  clients: clientsProp,
  onClientCreated,
  placeholder = 'Buscar cliente por empresa ou nome...',
  allowNone = false,
  noneLabel = 'Sem cliente',
  allowCreate = true,
  className,
  disabled,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<ComboClient[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });

  const clients = clientsProp ?? internal;

  useEffect(() => {
    if (clientsProp) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, company, phone, email')
        .order('name');
      if (!cancelled) setInternal((data as ComboClient[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [clientsProp]);

  const selected = useMemo(() => clients.find(c => c.id === value), [clients, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q)
    );
  }, [clients, query]);

  function openCreate() {
    const q = query.trim();
    setForm({ name: q, company: '', email: '', phone: '' });
    setOpen(false);
    setCreating(true);
  }

  async function createClient() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: 'active',
        created_by: user?.id,
      })
      .select('id, name, company, phone, email')
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast({ title: 'Erro ao criar cliente', description: error?.message, variant: 'destructive' });
      return;
    }
    const created = data as ComboClient;
    if (!clientsProp) setInternal(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    onClientCreated?.(created);
    onChange(created.id);
    setCreating(false);
    setQuery('');
    toast({ title: 'Cliente cadastrado!', description: label(created) });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn('w-full justify-between bg-muted border-border font-normal', className)}
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? label(selected) : (value === '' && allowNone ? noneLabel : 'Selecione o cliente')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </CommandEmpty>
              {allowNone && (
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={() => { onChange(''); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === '' ? 'opacity-100' : 'opacity-0')} />
                    {noneLabel}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {filtered.map(c => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => { onChange(c.id); setOpen(false); setQuery(''); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === c.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex flex-col">
                      <span className="text-foreground">{c.company || c.name}</span>
                      {c.company && <span className="text-xs text-muted-foreground">{c.name}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && (
                <CommandGroup>
                  <CommandItem value="__create__" onSelect={openCreate}>
                    <UserPlus className="mr-2 h-4 w-4 text-primary" />
                    {query.trim() ? `Cadastrar "${query.trim()}"` : 'Cadastrar novo cliente'}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={createClient} disabled={submitting || !form.name.trim()}>
              <Plus className="mr-2 h-4 w-4" /> Criar e selecionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
