import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, DollarSign, FileText, Receipt, Trash2, Edit, AlertTriangle,
  CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, Search
} from 'lucide-react';

// Types
interface Quote {
  id: string;
  client_id: string;
  title: string;
  services: { name: string; value: number }[];
  total_value: number;
  notes: string | null;
  valid_until: string | null;
  status: string;
  created_at: string;
  clients?: { name: string; company: string | null };
}

interface Invoice {
  id: string;
  client_id: string;
  quote_id: string | null;
  title: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string; company: string | null };
}

interface Client {
  id: string;
  name: string;
  company: string | null;
}

const quoteStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  sent: { label: 'Enviado', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: FileText },
  accepted: { label: 'Aceito', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  rejected: { label: 'Recusado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  expired: { label: 'Expirado', color: 'bg-muted text-muted-foreground', icon: AlertTriangle },
};

const invoiceStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  overdue: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

const paymentMethods: Record<string, string> = {
  pix: 'PIX', bank_transfer: 'Transferência', credit_card: 'Cartão', boleto: 'Boleto', other: 'Outro',
};

export default function Financial() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Quote form
  const [qClientId, setQClientId] = useState('');
  const [qTitle, setQTitle] = useState('');
  const [qServices, setQServices] = useState<{ name: string; value: number }[]>([{ name: '', value: 0 }]);
  const [qNotes, setQNotes] = useState('');
  const [qValidUntil, setQValidUntil] = useState('');
  const [qStatus, setQStatus] = useState('draft');

  // Invoice form
  const [iClientId, setIClientId] = useState('');
  const [iQuoteId, setIQuoteId] = useState('');
  const [iTitle, setITitle] = useState('');
  const [iAmount, setIAmount] = useState(0);
  const [iDueDate, setIDueDate] = useState('');
  const [iStatus, setIStatus] = useState('pending');
  const [iPaymentMethod, setIPaymentMethod] = useState('');
  const [iNotes, setINotes] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [q, i, c] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, company)').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, clients(name, company)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, company').eq('status', 'active').order('name'),
    ]);
    setQuotes((q.data as any) ?? []);
    setInvoices((i.data as any) ?? []);
    setClients(c.data ?? []);
  }

  // ---- QUOTE CRUD ----
  function openNewQuote() {
    setEditingQuote(null);
    setQClientId(''); setQTitle(''); setQServices([{ name: '', value: 0 }]);
    setQNotes(''); setQValidUntil(''); setQStatus('draft');
    setShowQuoteDialog(true);
  }

  function openEditQuote(q: Quote) {
    setEditingQuote(q);
    setQClientId(q.client_id); setQTitle(q.title);
    setQServices(q.services?.length ? q.services : [{ name: '', value: 0 }]);
    setQNotes(q.notes ?? ''); setQValidUntil(q.valid_until ?? ''); setQStatus(q.status);
    setShowQuoteDialog(true);
  }

  async function saveQuote() {
    const services = qServices.filter(s => s.name.trim());
    const total = services.reduce((acc, s) => acc + Number(s.value), 0);
    const payload = {
      client_id: qClientId, title: qTitle, services: services as any, total_value: total,
      notes: qNotes || null, valid_until: qValidUntil || null, status: qStatus as any,
      created_by: user?.id,
    };

    if (editingQuote) {
      const { error } = await supabase.from('quotes').update(payload).eq('id', editingQuote.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Orçamento atualizado!' });
    } else {
      const { error } = await supabase.from('quotes').insert(payload);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Orçamento criado!' });
    }
    setShowQuoteDialog(false);
    loadData();
  }

  async function deleteQuote(id: string) {
    await supabase.from('quotes').delete().eq('id', id);
    toast({ title: 'Orçamento excluído' });
    loadData();
  }

  // ---- INVOICE CRUD ----
  function openNewInvoice() {
    setEditingInvoice(null);
    setIClientId(''); setIQuoteId(''); setITitle('');
    setIAmount(0); setIDueDate(''); setIStatus('pending');
    setIPaymentMethod(''); setINotes('');
    setShowInvoiceDialog(true);
  }

  function openEditInvoice(inv: Invoice) {
    setEditingInvoice(inv);
    setIClientId(inv.client_id); setIQuoteId(inv.quote_id ?? ''); setITitle(inv.title);
    setIAmount(inv.amount); setIDueDate(inv.due_date); setIStatus(inv.status);
    setIPaymentMethod(inv.payment_method ?? ''); setINotes(inv.notes ?? '');
    setShowInvoiceDialog(true);
  }

  async function saveInvoice() {
    const payload = {
      client_id: iClientId, quote_id: iQuoteId || null, title: iTitle,
      amount: iAmount, due_date: iDueDate, status: iStatus as any,
      payment_method: (iPaymentMethod || null) as any, notes: iNotes || null,
      paid_at: iStatus === 'paid' ? new Date().toISOString() : null,
      created_by: user?.id,
    };

    if (editingInvoice) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', editingInvoice.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Fatura atualizada!' });
    } else {
      const { error } = await supabase.from('invoices').insert(payload);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Fatura criada!' });
    }
    setShowInvoiceDialog(false);
    loadData();
  }

  async function deleteInvoice(id: string) {
    await supabase.from('invoices').delete().eq('id', id);
    toast({ title: 'Fatura excluída' });
    loadData();
  }

  function createInvoiceFromQuote(q: Quote) {
    setEditingInvoice(null);
    setIClientId(q.client_id); setIQuoteId(q.id); setITitle(`Fatura - ${q.title}`);
    setIAmount(q.total_value); setIDueDate(''); setIStatus('pending');
    setIPaymentMethod(''); setINotes('');
    setShowInvoiceDialog(true);
  }

  // Stats
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + Number(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.amount), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + Number(i.amount), 0);
  const totalQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft').reduce((a, q) => a + Number(q.total_value), 0);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground">Orçamentos, faturas e cobranças</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos Abertos</CardTitle>
              <FileText className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{fmt(totalQuotes)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
              <Clock className="h-5 w-5 text-amber-400" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{fmt(totalPending)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{fmt(totalPaid)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Atrasado</CardTitle>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{fmt(totalOverdue)}</div></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="invoices">Faturas</TabsTrigger>
              <TabsTrigger value="quotes">Orçamentos</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-56 bg-card border-border" />
              </div>
            </div>
          </div>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewInvoice}><Plus className="mr-2 h-4 w-4" /> Nova Fatura</Button>
            </div>
            <Card className="border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices
                    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
                      i.clients?.name.toLowerCase().includes(search.toLowerCase()))
                    .map(inv => {
                      const st = invoiceStatusConfig[inv.status] ?? invoiceStatusConfig.pending;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-foreground">{inv.title}</TableCell>
                          <TableCell className="text-muted-foreground">{inv.clients?.name}</TableCell>
                          <TableCell className="font-medium text-foreground">{fmt(Number(inv.amount))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.color}>
                              <StIcon className="mr-1 h-3 w-3" />{st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.payment_method ? paymentMethods[inv.payment_method] ?? inv.payment_method : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditInvoice(inv)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteInvoice(inv.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma fatura cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* QUOTES TAB */}
          <TabsContent value="quotes" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewQuote}><Plus className="mr-2 h-4 w-4" /> Novo Orçamento</Button>
            </div>
            <Card className="border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes
                    .filter(q => !search || q.title.toLowerCase().includes(search.toLowerCase()) ||
                      q.clients?.name.toLowerCase().includes(search.toLowerCase()))
                    .map(q => {
                      const st = quoteStatusConfig[q.status] ?? quoteStatusConfig.draft;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium text-foreground">{q.title}</TableCell>
                          <TableCell className="text-muted-foreground">{q.clients?.name}</TableCell>
                          <TableCell className="font-medium text-foreground">{fmt(Number(q.total_value))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {q.valid_until ? new Date(q.valid_until).toLocaleDateString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.color}>
                              <StIcon className="mr-1 h-3 w-3" />{st.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {q.status === 'accepted' && (
                                <Button variant="ghost" size="icon" title="Gerar fatura"
                                  onClick={() => createInvoiceFromQuote(q)}>
                                  <Receipt className="h-4 w-4 text-emerald-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => openEditQuote(q)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteQuote(q.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {quotes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum orçamento cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* QUOTE DIALOG */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuote ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={qClientId} onValueChange={setQClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` - ${c.company}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={qTitle} onChange={e => setQTitle(e.target.value)} placeholder="Ex: Pacote Social Media" />
            </div>
            <div>
              <Label>Serviços</Label>
              <div className="space-y-2">
                {qServices.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Serviço" value={s.name}
                      onChange={e => { const arr = [...qServices]; arr[i].name = e.target.value; setQServices(arr); }}
                      className="flex-1" />
                    <Input type="number" placeholder="Valor" value={s.value || ''}
                      onChange={e => { const arr = [...qServices]; arr[i].value = Number(e.target.value); setQServices(arr); }}
                      className="w-32" />
                    {qServices.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setQServices(qServices.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setQServices([...qServices, { name: '', value: 0 }])}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar Serviço
                </Button>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                Total: {fmt(qServices.reduce((a, s) => a + Number(s.value), 0))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Validade</Label>
                <Input type="date" value={qValidUntil} onChange={e => setQValidUntil(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={qStatus} onValueChange={setQStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="accepted">Aceito</SelectItem>
                    <SelectItem value="rejected">Recusado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={qNotes} onChange={e => setQNotes(e.target.value)} rows={2} />
            </div>
            <Button className="w-full" onClick={saveQuote} disabled={!qClientId || !qTitle}>
              {editingQuote ? 'Salvar Alterações' : 'Criar Orçamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* INVOICE DIALOG */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Editar Fatura' : 'Nova Fatura'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={iClientId} onValueChange={setIClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` - ${c.company}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder="Ex: Fatura Abril 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" value={iAmount || ''} onChange={e => setIAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={iDueDate} onChange={e => setIDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={iStatus} onValueChange={setIStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Método de Pagamento</Label>
                <Select value={iPaymentMethod} onValueChange={setIPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={iNotes} onChange={e => setINotes(e.target.value)} rows={2} />
            </div>
            <Button className="w-full" onClick={saveInvoice} disabled={!iClientId || !iTitle || !iDueDate}>
              {editingInvoice ? 'Salvar Alterações' : 'Criar Fatura'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
