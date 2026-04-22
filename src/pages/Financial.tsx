import { useEffect, useState, useCallback } from 'react';
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
  CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, Search,
  MessageCircle, CreditCard, RefreshCw, Paperclip, Upload
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
  clients?: { name: string; company: string | null; phone: string | null };
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
  recurrence: string;
  recurrence_day: number | null;
  recurrence_end: string | null;
  is_recurring_active: boolean;
  project_id: string | null;
  financial_type: string;
  clients?: { name: string; company: string | null; phone: string | null };
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  financial_type: string;
  due_date: string;
  status: string;
  recurrence: string;
  recurrence_day: number | null;
  recurrence_end: string | null;
  is_recurring_active: boolean;
  client_id: string | null;
  project_id: string | null;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string; company: string | null } | null;
  projects?: { name: string } | null;
}

interface Client {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
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

const expenseStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  overdue: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
};

const paymentMethods: Record<string, string> = {
  pix: 'PIX', bank_transfer: 'Transferência', credit_card: 'Cartão', boleto: 'Boleto', other: 'Outro',
};

const expenseCategories = [
  'Aluguel', 'Internet', 'Software', 'Equipamentos', 'Marketing', 'Freelancers',
  'Impostos', 'Transporte', 'Alimentação', 'Material', 'Outros'
];

function clientDisplay(client?: { name: string; company: string | null } | null) {
  if (!client) return '—';
  if (client.company) return (
    <div>
      <div className="font-medium text-foreground">{client.company}</div>
      <div className="text-xs text-muted-foreground">{client.name}</div>
    </div>
  );
  return <span className="text-foreground">{client.name}</span>;
}

function clientSelectLabel(c: Client) {
  return c.company ? `${c.company} | ${c.name}` : c.name;
}

export default function Financial() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
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
  const [iRecurrence, setIRecurrence] = useState('one_time');
  const [iRecurrenceDay, setIRecurrenceDay] = useState('');
  const [iRecurrenceEnd, setIRecurrenceEnd] = useState('');
  const [iProjectId, setIProjectId] = useState('');

  // Expense form
  const [eDescription, setEDescription] = useState('');
  const [eAmount, setEAmount] = useState(0);
  const [eCategory, setECategory] = useState('');
  const [eDueDate, setEDueDate] = useState('');
  const [eStatus, setEStatus] = useState('pending');
  const [eRecurrence, setERecurrence] = useState('one_time');
  const [eRecurrenceDay, setERecurrenceDay] = useState('');
  const [eRecurrenceEnd, setERecurrenceEnd] = useState('');
  const [eClientId, setEClientId] = useState('');
  const [eProjectId, setEProjectId] = useState('');
  const [eNotes, setENotes] = useState('');
  const [eAttachment, setEAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [q, i, c, p, ex] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, company, phone)').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, clients(name, company, phone)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, company, phone').eq('status', 'active').order('name'),
      supabase.from('projects').select('id, name, client_id').order('name'),
      supabase.from('expenses').select('*, clients(name, company), projects(name)').eq('financial_type', 'pj').order('created_at', { ascending: false }),
    ]);
    setQuotes((q.data as any) ?? []);
    const invoiceData = (i.data as any) ?? [];
    // Auto-update overdue invoices
    const today = new Date().toISOString().split('T')[0];
    const toUpdate = invoiceData.filter((inv: any) => inv.status === 'pending' && inv.due_date < today);
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map((inv: any) =>
        supabase.from('invoices').update({ status: 'overdue' as any }).eq('id', inv.id)
      ));
      toUpdate.forEach((inv: any) => { inv.status = 'overdue'; });
    }
    setInvoices(invoiceData);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
    // Auto-update overdue expenses
    const expData = (ex.data as any) ?? [];
    const expToUpdate = expData.filter((e: any) => e.status === 'pending' && e.due_date < today);
    if (expToUpdate.length > 0) {
      await Promise.all(expToUpdate.map((e: any) =>
        supabase.from('expenses').update({ status: 'overdue' as any }).eq('id', e.id)
      ));
      expToUpdate.forEach((e: any) => { e.status = 'overdue'; });
    }
    setExpenses(expData);
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
    setIRecurrence('one_time'); setIRecurrenceDay(''); setIRecurrenceEnd(''); setIProjectId('');
    setShowInvoiceDialog(true);
  }

  function openEditInvoice(inv: Invoice) {
    setEditingInvoice(inv);
    setIClientId(inv.client_id); setIQuoteId(inv.quote_id ?? ''); setITitle(inv.title);
    setIAmount(inv.amount); setIDueDate(inv.due_date); setIStatus(inv.status);
    setIPaymentMethod(inv.payment_method ?? ''); setINotes(inv.notes ?? '');
    setIRecurrence(inv.recurrence ?? 'one_time');
    setIRecurrenceDay(inv.recurrence_day?.toString() ?? '');
    setIRecurrenceEnd(inv.recurrence_end ?? '');
    setIProjectId(inv.project_id ?? '');
    setShowInvoiceDialog(true);
  }

  async function saveInvoice() {
    const payload: any = {
      client_id: iClientId, quote_id: iQuoteId || null, title: iTitle,
      amount: iAmount, due_date: iDueDate, status: iStatus as any,
      payment_method: (iPaymentMethod || null) as any, notes: iNotes || null,
      paid_at: iStatus === 'paid' ? new Date().toISOString() : null,
      created_by: user?.id,
      recurrence: iRecurrence as any,
      recurrence_day: iRecurrenceDay ? parseInt(iRecurrenceDay) : null,
      recurrence_end: iRecurrenceEnd || null,
      project_id: iProjectId || null,
      financial_type: 'pj' as any,
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

  async function markInvoicePaid(inv: Invoice) {
    await supabase.from('invoices').update({
      status: 'paid' as any, paid_at: new Date().toISOString(), payment_method: 'pix' as any
    }).eq('id', inv.id);
    toast({ title: 'Fatura marcada como paga!' });
    loadData();
  }

  function sendWhatsApp(inv: Invoice) {
    const client = clients.find(c => c.id === inv.client_id);
    if (!client?.phone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' });
      return;
    }
    const phone = client.phone.replace(/\D/g, '');
    const empresa = client.company || client.name;
    const valor = fmt(Number(inv.amount));
    const venc = new Date(inv.due_date).toLocaleDateString('pt-BR');
    const msg = `Olá! Segue cobrança da *${empresa}*:\n\n📄 ${inv.title}\n💰 Valor: *${valor}*\n📅 Vencimento: *${venc}*\n\nQualquer dúvida, estamos à disposição!`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function createInvoiceFromQuote(q: Quote) {
    setEditingInvoice(null);
    setIClientId(q.client_id); setIQuoteId(q.id); setITitle(`Fatura - ${q.title}`);
    setIAmount(q.total_value); setIDueDate(''); setIStatus('pending');
    setIPaymentMethod(''); setINotes('');
    setIRecurrence('one_time'); setIRecurrenceDay(''); setIRecurrenceEnd(''); setIProjectId('');
    setShowInvoiceDialog(true);
  }

  // ---- EXPENSE CRUD ----
  function openNewExpense() {
    setEditingExpense(null);
    setEDescription(''); setEAmount(0); setECategory(''); setEDueDate('');
    setEStatus('pending'); setERecurrence('one_time'); setERecurrenceDay('');
    setERecurrenceEnd(''); setEClientId(''); setEProjectId(''); setENotes(''); setEAttachment(null);
    setShowExpenseDialog(true);
  }

  function openEditExpense(e: Expense) {
    setEditingExpense(e);
    setEDescription(e.description); setEAmount(e.amount); setECategory(e.category ?? '');
    setEDueDate(e.due_date); setEStatus(e.status); setERecurrence(e.recurrence);
    setERecurrenceDay(e.recurrence_day?.toString() ?? ''); setERecurrenceEnd(e.recurrence_end ?? '');
    setEClientId(e.client_id ?? ''); setEProjectId(e.project_id ?? ''); setENotes(e.notes ?? '');
    setEAttachment(null);
    setShowExpenseDialog(true);
  }

  async function saveExpense() {
    let attachmentUrl = editingExpense?.attachment_url ?? null;
    if (eAttachment) {
      setUploading(true);
      const ext = eAttachment.name.split('.').pop();
      const path = `expenses/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('content-files').upload(path, eAttachment);
      if (upErr) { toast({ title: 'Erro no upload', variant: 'destructive' }); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from('content-files').getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;
      setUploading(false);
    }

    const payload: any = {
      description: eDescription, amount: eAmount, category: eCategory || null,
      financial_type: 'pj' as any, due_date: eDueDate, status: eStatus as any,
      recurrence: eRecurrence as any, recurrence_day: eRecurrenceDay ? parseInt(eRecurrenceDay) : null,
      recurrence_end: eRecurrenceEnd || null, client_id: eClientId || null,
      project_id: eProjectId || null, notes: eNotes || null,
      attachment_url: attachmentUrl, created_by: user?.id,
    };

    if (editingExpense) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Despesa atualizada!' });
    } else {
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Despesa criada!' });
    }
    setShowExpenseDialog(false);
    loadData();
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    toast({ title: 'Despesa excluída' });
    loadData();
  }

  async function markExpensePaid(e: Expense) {
    await supabase.from('expenses').update({ status: 'paid' as any }).eq('id', e.id);
    toast({ title: 'Despesa marcada como paga!' });
    loadData();
  }

  // Stats
  const pjInvoices = invoices.filter(i => (i.financial_type ?? 'pj') === 'pj');
  const totalPending = pjInvoices.filter(i => i.status === 'pending').reduce((a, i) => a + Number(i.amount), 0);
  const totalPaid = pjInvoices.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.amount), 0);
  const totalOverdue = pjInvoices.filter(i => i.status === 'overdue').reduce((a, i) => a + Number(i.amount), 0);
  const totalQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft').reduce((a, q) => a + Number(q.total_value), 0);
  const totalExpenses = expenses.filter(e => e.status === 'paid').reduce((a, e) => a + Number(e.amount), 0);
  const profit = totalPaid - totalExpenses;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Financeiro PJ</h1>
            <p className="text-muted-foreground">Orçamentos, faturas, despesas e cobranças</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas PJ</CardTitle>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{fmt(totalExpenses)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lucro</CardTitle>
              <DollarSign className={`h-5 w-5 ${profit >= 0 ? 'text-emerald-400' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent><div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>{fmt(profit)}</div></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="invoices">Faturas</TabsTrigger>
              <TabsTrigger value="expenses">Despesas</TabsTrigger>
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="w-36">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pjInvoices
                    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
                      i.clients?.name.toLowerCase().includes(search.toLowerCase()) ||
                      i.clients?.company?.toLowerCase().includes(search.toLowerCase()))
                    .map(inv => {
                      const st = invoiceStatusConfig[inv.status] ?? invoiceStatusConfig.pending;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-foreground">{inv.title}</TableCell>
                          <TableCell>{clientDisplay(inv.clients)}</TableCell>
                          <TableCell className="font-medium text-foreground">{fmt(Number(inv.amount))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {inv.recurrence === 'recurring' ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                <RefreshCw className="mr-1 h-3 w-3" />Recorrente
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Única</span>
                            )}
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
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <>
                                  <Button variant="ghost" size="icon" title="Marcar como pago"
                                    onClick={() => markInvoicePaid(inv)}>
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Enviar WhatsApp"
                                    onClick={() => sendWhatsApp(inv)}>
                                    <MessageCircle className="h-4 w-4 text-green-500" />
                                  </Button>
                                </>
                              )}
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
                  {pjInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma fatura cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewExpense}><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Button>
            </div>
            <Card className="border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente/Projeto</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses
                    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) ||
                      e.category?.toLowerCase().includes(search.toLowerCase()))
                    .map(exp => {
                      const st = expenseStatusConfig[exp.status] ?? expenseStatusConfig.pending;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {exp.description}
                              {exp.attachment_url && (
                                <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{exp.category ?? '—'}</TableCell>
                          <TableCell className="font-medium text-destructive">{fmt(Number(exp.amount))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(exp.due_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {exp.recurrence === 'recurring' ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                <RefreshCw className="mr-1 h-3 w-3" />Recorrente
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Única</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.color}>
                              <StIcon className="mr-1 h-3 w-3" />{st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {exp.clients?.company || exp.clients?.name || '—'}
                            {exp.projects?.name && <div>{exp.projects.name}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {exp.status !== 'paid' && (
                                <Button variant="ghost" size="icon" title="Marcar como pago"
                                  onClick={() => markExpensePaid(exp)}>
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => openEditExpense(exp)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma despesa cadastrada
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
                      q.clients?.name.toLowerCase().includes(search.toLowerCase()) ||
                      q.clients?.company?.toLowerCase().includes(search.toLowerCase()))
                    .map(q => {
                      const st = quoteStatusConfig[q.status] ?? quoteStatusConfig.draft;
                      const StIcon = st.icon;
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium text-foreground">{q.title}</TableCell>
                          <TableCell>{clientDisplay(q.clients)}</TableCell>
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
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientSelectLabel(c)}</SelectItem>)}
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
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientSelectLabel(c)}</SelectItem>)}
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
                <Label>Tipo</Label>
                <Select value={iRecurrence} onValueChange={setIRecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">Única</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={iProjectId || '__none__'} onValueChange={(v) => setIProjectId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {projects.filter(p => !iClientId || p.client_id === iClientId).map(p =>
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {iRecurrence === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dia de cobrança</Label>
                  <Input type="number" min="1" max="31" value={iRecurrenceDay}
                    onChange={e => setIRecurrenceDay(e.target.value)} placeholder="Ex: 10" />
                </div>
                <div>
                  <Label>Data final (opcional)</Label>
                  <Input type="date" value={iRecurrenceEnd} onChange={e => setIRecurrenceEnd(e.target.value)} />
                </div>
              </div>
            )}
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

      {/* EXPENSE DIALOG */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input value={eDescription} onChange={e => setEDescription(e.target.value)} placeholder="Ex: Aluguel escritório" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" value={eAmount || ''} onChange={e => setEAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={eCategory} onValueChange={setECategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={eDueDate} onChange={e => setEDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={eRecurrence} onValueChange={setERecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">Única</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {eRecurrence === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dia de vencimento</Label>
                  <Input type="number" min="1" max="31" value={eRecurrenceDay}
                    onChange={e => setERecurrenceDay(e.target.value)} placeholder="Ex: 5" />
                </div>
                <div>
                  <Label>Data final (opcional)</Label>
                  <Input type="date" value={eRecurrenceEnd} onChange={e => setERecurrenceEnd(e.target.value)} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cliente (opcional)</Label>
                <Select value={eClientId || '__none__'} onValueChange={(v) => setEClientId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientSelectLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto (opcional)</Label>
                <Select value={eProjectId || '__none__'} onValueChange={(v) => setEProjectId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={eStatus} onValueChange={setEStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comprovante (opcional)</Label>
              <Input type="file" onChange={e => setEAttachment(e.target.files?.[0] ?? null)}
                accept="image/*,.pdf" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} />
            </div>
            <Button className="w-full" onClick={saveExpense} disabled={!eDescription || !eDueDate || uploading}>
              {uploading ? 'Enviando...' : editingExpense ? 'Salvar Alterações' : 'Criar Despesa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
