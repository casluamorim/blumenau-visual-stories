import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Loader2, RefreshCw, Send, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Client = Database['public']['Tables']['clients']['Row'];

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  RECEIVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  OVERDUE: 'bg-destructive/10 text-destructive border-destructive/20',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Aguardando',
  RECEIVED: 'Pago',
  CONFIRMED: 'Pago',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

interface Props {
  open: boolean;
  client: Client | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ClientBillingDialog({ open, client, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [charging, setCharging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [cfg, setCfg] = useState({
    billing_enabled: false,
    billing_amount: '',
    billing_due_day: '10',
    billing_type: 'PIX',
    billing_description: '',
    billing_cpf_cnpj: '',
    asaas_account: '1',
  });

  const [oneOff, setOneOff] = useState({ amount: '', due_date: '', description: '' });

  // Sincroniza formulário quando o diálogo abre para outro cliente
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (open && client && loadedId !== client.id) {
    setLoadedId(client.id);
    setCfg({
      billing_enabled: client.billing_enabled ?? false,
      billing_amount: client.billing_amount != null ? String(client.billing_amount) : '',
      billing_due_day: client.billing_due_day != null ? String(client.billing_due_day) : '10',
      billing_type: client.billing_type ?? 'PIX',
      billing_description: client.billing_description ?? '',
      billing_cpf_cnpj: client.billing_cpf_cnpj ?? '',
      asaas_account: (client as any).asaas_account ?? '1',
    });
    setOneOff({ amount: '', due_date: '', description: '' });
  }

  const { data: accounts } = useQuery({
    queryKey: ['asaas-accounts'],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('agency_settings')
        .select('asaas_account_1_label, asaas_account_1_cnpj, asaas_account_2_label, asaas_account_2_cnpj')
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const accountLabel = (n: '1' | '2') => {
    const label = accounts?.[`asaas_account_${n}_label`];
    const cnpj = accounts?.[`asaas_account_${n}_cnpj`];
    return [label || `Conta ${n}`, cnpj].filter(Boolean).join(' · ');
  };

  const { data: charges = [], isFetching } = useQuery({
    queryKey: ['asaas-charges', client?.id],
    enabled: open && !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asaas_charges')
        .select('*')
        .eq('client_id', client!.id)
        .order('due_date', { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  function refreshCharges() {
    qc.invalidateQueries({ queryKey: ['asaas-charges', client?.id] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
  }

  async function saveConfig() {
    if (!client) return;
    const amount = cfg.billing_amount ? Number(cfg.billing_amount.replace(',', '.')) : null;
    const dueDay = Number(cfg.billing_due_day);
    if (cfg.billing_enabled) {
      if (!amount || amount <= 0) { toast({ title: 'Informe o valor da cobrança', variant: 'destructive' }); return; }
      if (!dueDay || dueDay < 1 || dueDay > 28) { toast({ title: 'Dia de vencimento deve ser entre 1 e 28', variant: 'destructive' }); return; }
      if (!cfg.billing_cpf_cnpj.replace(/\D/g, '')) { toast({ title: 'CPF/CNPJ é obrigatório para cobrar', variant: 'destructive' }); return; }
    }
    setSaving(true);
    const accountChanged = ((client as any).asaas_account ?? '1') !== cfg.asaas_account;
    const { error } = await supabase.from('clients').update({
      asaas_account: cfg.asaas_account,
      // Ao trocar de conta (CNPJ), o cliente precisa ser recriado na nova conta
      ...(accountChanged ? { asaas_customer_id: null } : {}),
      billing_enabled: cfg.billing_enabled,
      billing_amount: amount,
      billing_due_day: dueDay || null,
      billing_type: cfg.billing_type,
      billing_description: cfg.billing_description || null,
      billing_cpf_cnpj: cfg.billing_cpf_cnpj || null,
    }).eq('id', client.id);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cobrança configurada!', description: cfg.billing_enabled ? 'A cobrança será gerada automaticamente todo mês.' : 'Cobrança automática desativada.' });
    onSaved?.();
  }

  async function invokeBilling(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('asaas-billing', { body });
    const err = (data as any)?.error ?? error?.message;
    if (err) throw new Error(err);
    return data as any;
  }

  async function createOneOff() {
    if (!client) return;
    const amount = Number((oneOff.amount || '').replace(',', '.'));
    if (!amount || amount <= 0) { toast({ title: 'Informe o valor', variant: 'destructive' }); return; }
    if (!oneOff.due_date) { toast({ title: 'Informe o vencimento', variant: 'destructive' }); return; }
    setCharging(true);
    try {
      await invokeBilling({
        action: 'create_charge',
        client_id: client.id,
        amount,
        due_date: oneOff.due_date,
        description: oneOff.description || `Serviços — ${client.company || client.name}`,
        billing_type: cfg.billing_type,
      });
      toast({ title: 'Cobrança criada!', description: 'O cliente já pode pagar pelo link.' });
      setOneOff({ amount: '', due_date: '', description: '' });
      refreshCharges();
    } catch (e) {
      toast({ title: 'Erro ao criar cobrança', description: String((e as Error).message), variant: 'destructive' });
    }
    setCharging(false);
  }

  async function runNow() {
    setCharging(true);
    try {
      const res = await invokeBilling({ action: 'run_recurring' });
      const okCount = (res?.results ?? []).filter((r: any) => r.ok).length;
      toast({ title: 'Cobranças processadas', description: `${okCount} cobrança(s) gerada(s) neste mês.` });
      refreshCharges();
    } catch (e) {
      toast({ title: 'Erro', description: String((e as Error).message), variant: 'destructive' });
    }
    setCharging(false);
  }

  async function chargeAction(action: 'refresh_charge' | 'cancel_charge', id: string) {
    setBusyId(id);
    try {
      await invokeBilling({ action, charge_id: id });
      refreshCharges();
    } catch (e) {
      toast({ title: 'Erro', description: String((e as Error).message), variant: 'destructive' });
    }
    setBusyId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="h-4 w-4 text-primary" /> Cobrança automática — {client?.name}
          </DialogTitle>
          <DialogDescription>
            Defina quanto e quando cobrar. As cobranças são emitidas pelo Asaas e o pagamento baixa a fatura automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cobrança mensal automática</p>
              <p className="text-xs text-muted-foreground">Gera a cobrança todo mês no dia escolhido.</p>
            </div>
            <Switch checked={cfg.billing_enabled} onCheckedChange={v => setCfg(s => ({ ...s, billing_enabled: v }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Valor mensal (R$)</Label>
              <Input inputMode="decimal" placeholder="1500,00" value={cfg.billing_amount}
                onChange={e => setCfg(s => ({ ...s, billing_amount: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div>
              <Label>Dia do vencimento</Label>
              <Input type="number" min={1} max={28} value={cfg.billing_due_day}
                onChange={e => setCfg(s => ({ ...s, billing_due_day: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={cfg.billing_type} onValueChange={v => setCfg(s => ({ ...s, billing_type: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                  <SelectItem value="UNDEFINED">Cliente escolhe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conta Asaas (CNPJ que vai receber)</Label>
            <Select value={cfg.asaas_account} onValueChange={v => setCfg(s => ({ ...s, asaas_account: v }))}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{accountLabel('1')}</SelectItem>
                <SelectItem value="2">{accountLabel('2')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Todas as cobranças deste cliente são emitidas nesta conta automaticamente.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>CPF/CNPJ do cliente *</Label>
              <Input placeholder="00.000.000/0000-00" value={cfg.billing_cpf_cnpj}
                onChange={e => setCfg(s => ({ ...s, billing_cpf_cnpj: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div>
              <Label>Descrição na cobrança</Label>
              <Input placeholder="Gestão de social media" value={cfg.billing_description}
                onChange={e => setCfg(s => ({ ...s, billing_description: e.target.value }))} className="bg-muted border-border" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar configuração
            </Button>
            <Button variant="outline" onClick={runNow} disabled={charging}>
              <Send className="mr-2 h-4 w-4" /> Gerar cobranças do mês
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Cobrança avulsa</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" placeholder="500,00" value={oneOff.amount}
                  onChange={e => setOneOff(s => ({ ...s, amount: e.target.value }))} className="bg-muted border-border" />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={oneOff.due_date}
                  onChange={e => setOneOff(s => ({ ...s, due_date: e.target.value }))} className="bg-muted border-border" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input placeholder="Campanha extra" value={oneOff.description}
                  onChange={e => setOneOff(s => ({ ...s, description: e.target.value }))} className="bg-muted border-border" />
              </div>
            </div>
            <Button variant="secondary" onClick={createOneOff} disabled={charging}>
              {charging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Criar cobrança avulsa
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Histórico de cobranças {isFetching ? '...' : ''}</p>
            {charges.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada ainda.</p>
            )}
            {charges.map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{c.description ?? 'Cobrança'}</p>
                  <p className="text-xs text-muted-foreground">
                    {brl(Number(c.amount))} · vence {new Date(`${c.due_date}T00:00:00`).toLocaleDateString('pt-BR')} · {c.billing_type}
                    {c.is_recurring ? ' · recorrente' : ''}
                    {` · ${accountLabel(String(c.asaas_account ?? '1') === '2' ? '2' : '1')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusStyles[c.status] ?? ''}>
                    {statusLabels[c.status] ?? c.status}
                  </Badge>
                  {c.invoice_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Abrir fatura">
                      <a href={c.invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Atualizar status"
                    disabled={busyId === c.id} onClick={() => chargeAction('refresh_charge', c.id)}>
                    <RefreshCw className={`h-4 w-4 ${busyId === c.id ? 'animate-spin' : ''}`} />
                  </Button>
                  {!['RECEIVED', 'CONFIRMED', 'CANCELLED'].includes(c.status) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Cancelar cobrança"
                      disabled={busyId === c.id} onClick={() => chargeAction('cancel_charge', c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
