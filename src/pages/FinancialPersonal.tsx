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
  Plus, Trash2, Edit, CheckCircle, Clock, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, RefreshCw, Search, Paperclip
} from 'lucide-react';

interface PFIncome {
  id: string; description: string; amount: number; category: string | null;
  due_date: string; status: string; recurrence: string; recurrence_day: number | null;
  recurrence_end: string | null; is_recurring_active: boolean; notes: string | null;
  attachment_url: string | null; created_at: string;
}

interface PFExpense {
  id: string; description: string; amount: number; category: string | null;
  due_date: string; status: string; recurrence: string; recurrence_day: number | null;
  recurrence_end: string | null; is_recurring_active: boolean; notes: string | null;
  attachment_url: string | null; created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  overdue: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
};

const incomeCategories = ['Salário', 'Freelance', 'Aluguel', 'Investimentos', 'Outros'];
const expenseCategories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Outros'];

export default function FinancialPersonal() {
  const [incomes, setIncomes] = useState<PFIncome[]>([]);
  const [expenses, setExpenses] = useState<PFExpense[]>([]);
  const [search, setSearch] = useState('');
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<PFIncome | null>(null);
  const [editingExpense, setEditingExpense] = useState<PFExpense | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Income form
  const [iDesc, setIDesc] = useState(''); const [iAmt, setIAmt] = useState(0);
  const [iCat, setICat] = useState(''); const [iDate, setIDate] = useState('');
  const [iStatus, setIStatus] = useState('pending'); const [iRec, setIRec] = useState('one_time');
  const [iRecDay, setIRecDay] = useState(''); const [iRecEnd, setIRecEnd] = useState('');
  const [iNotes, setINotes] = useState('');

  // Expense form
  const [eDesc, setEDesc] = useState(''); const [eAmt, setEAmt] = useState(0);
  const [eCat, setECat] = useState(''); const [eDate, setEDate] = useState('');
  const [eStatus, setEStatus] = useState('pending'); const [eRec, setERec] = useState('one_time');
  const [eRecDay, setERecDay] = useState(''); const [eRecEnd, setERecEnd] = useState('');
  const [eNotes, setENotes] = useState(''); const [eAttachment, setEAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const today = new Date().toISOString().split('T')[0];
    const [inc, exp] = await Promise.all([
      supabase.from('personal_income').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('financial_type', 'pf').order('created_at', { ascending: false }),
    ]);
    const incData = (inc.data as any) ?? [];
    const expData = (exp.data as any) ?? [];
    // Auto overdue
    for (const arr of [incData, expData]) {
      const overdue = arr.filter((r: any) => r.status === 'pending' && r.due_date < today);
      if (overdue.length) {
        const table = arr === incData ? 'personal_income' : 'expenses';
        await Promise.all(overdue.map((r: any) =>
          supabase.from(table).update({ status: 'overdue' as any }).eq('id', r.id)
        ));
        overdue.forEach((r: any) => { r.status = 'overdue'; });
      }
    }
    setIncomes(incData);
    setExpenses(expData);
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const totalIncPaid = incomes.filter(i => i.status === 'paid').reduce((a, i) => a + Number(i.amount), 0);
  const totalExpPaid = expenses.filter(e => e.status === 'paid').reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIncPaid - totalExpPaid;

  // Income CRUD
  function openNewIncome() {
    setEditingIncome(null); setIDesc(''); setIAmt(0); setICat(''); setIDate('');
    setIStatus('pending'); setIRec('one_time'); setIRecDay(''); setIRecEnd(''); setINotes('');
    setShowIncomeDialog(true);
  }
  function openEditIncome(inc: PFIncome) {
    setEditingIncome(inc); setIDesc(inc.description); setIAmt(inc.amount); setICat(inc.category ?? '');
    setIDate(inc.due_date); setIStatus(inc.status); setIRec(inc.recurrence);
    setIRecDay(inc.recurrence_day?.toString() ?? ''); setIRecEnd(inc.recurrence_end ?? ''); setINotes(inc.notes ?? '');
    setShowIncomeDialog(true);
  }
  async function saveIncome() {
    const payload: any = {
      description: iDesc, amount: iAmt, category: iCat || null, due_date: iDate,
      status: iStatus as any, recurrence: iRec as any,
      recurrence_day: iRecDay ? parseInt(iRecDay) : null,
      recurrence_end: iRecEnd || null, notes: iNotes || null, created_by: user?.id,
    };
    if (editingIncome) {
      await supabase.from('personal_income').update(payload).eq('id', editingIncome.id);
      toast({ title: 'Receita atualizada!' });
    } else {
      await supabase.from('personal_income').insert(payload);
      toast({ title: 'Receita criada!' });
    }
    setShowIncomeDialog(false); loadData();
  }
  async function deleteIncome(id: string) {
    await supabase.from('personal_income').delete().eq('id', id);
    toast({ title: 'Receita excluída' }); loadData();
  }
  async function markIncomePaid(id: string) {
    await supabase.from('personal_income').update({ status: 'paid' as any }).eq('id', id);
    toast({ title: 'Receita marcada como paga!' }); loadData();
  }

  // Expense CRUD
  function openNewExpense() {
    setEditingExpense(null); setEDesc(''); setEAmt(0); setECat(''); setEDate('');
    setEStatus('pending'); setERec('one_time'); setERecDay(''); setERecEnd(''); setENotes(''); setEAttachment(null);
    setShowExpenseDialog(true);
  }
  function openEditExpense(exp: PFExpense) {
    setEditingExpense(exp); setEDesc(exp.description); setEAmt(exp.amount); setECat(exp.category ?? '');
    setEDate(exp.due_date); setEStatus(exp.status); setERec(exp.recurrence);
    setERecDay(exp.recurrence_day?.toString() ?? ''); setERecEnd(exp.recurrence_end ?? ''); setENotes(exp.notes ?? '');
    setEAttachment(null);
    setShowExpenseDialog(true);
  }
  async function saveExpense() {
    let attachmentUrl = editingExpense?.attachment_url ?? null;
    if (eAttachment) {
      setUploading(true);
      const path = `expenses-pf/${Date.now()}.${eAttachment.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('content-files').upload(path, eAttachment);
      if (error) { toast({ title: 'Erro no upload', variant: 'destructive' }); setUploading(false); return; }
      attachmentUrl = supabase.storage.from('content-files').getPublicUrl(path).data.publicUrl;
      setUploading(false);
    }
    const payload: any = {
      description: eDesc, amount: eAmt, category: eCat || null, financial_type: 'pf' as any,
      due_date: eDate, status: eStatus as any, recurrence: eRec as any,
      recurrence_day: eRecDay ? parseInt(eRecDay) : null, recurrence_end: eRecEnd || null,
      notes: eNotes || null, attachment_url: attachmentUrl, created_by: user?.id,
    };
    if (editingExpense) {
      await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
      toast({ title: 'Despesa atualizada!' });
    } else {
      await supabase.from('expenses').insert(payload);
      toast({ title: 'Despesa criada!' });
    }
    setShowExpenseDialog(false); loadData();
  }
  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    toast({ title: 'Despesa excluída' }); loadData();
  }
  async function markExpensePaid(id: string) {
    await supabase.from('expenses').update({ status: 'paid' as any }).eq('id', id);
    toast({ title: 'Despesa marcada como paga!' }); loadData();
  }

  function renderTable(data: any[], type: 'income' | 'expense') {
    const isIncome = type === 'income';
    return (
      <div className="table-scroll"><Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.filter(r => !search || r.description.toLowerCase().includes(search.toLowerCase())).map(r => {
            const st = statusConfig[r.status] ?? statusConfig.pending;
            const StIcon = st.icon;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    {r.description}
                    {r.attachment_url && <a href={r.attachment_url} target="_blank"><Paperclip className="h-3 w-3 text-muted-foreground" /></a>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.category ?? '—'}</TableCell>
                <TableCell className={`font-medium ${isIncome ? 'text-emerald-400' : 'text-destructive'}`}>{fmt(Number(r.amount))}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(r.due_date).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  {r.recurrence === 'recurring' ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                      <RefreshCw className="mr-1 h-3 w-3" />Recorrente
                    </Badge>
                  ) : <span className="text-muted-foreground text-xs">Única</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={st.color}><StIcon className="mr-1 h-3 w-3" />{st.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.status !== 'paid' && (
                      <Button variant="ghost" size="icon" title="Marcar como pago"
                        onClick={() => isIncome ? markIncomePaid(r.id) : markExpensePaid(r.id)}>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => isIncome ? openEditIncome(r) : openEditExpense(r)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => isIncome ? deleteIncome(r.id) : deleteExpense(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Financeiro PF</h1>
          <p className="text-muted-foreground">Receitas e despesas pessoais</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receitas PF</CardTitle>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-400">{fmt(totalIncPaid)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas PF</CardTitle>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{fmt(totalExpPaid)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo PF</CardTitle>
              <DollarSign className={`h-5 w-5 ${balance >= 0 ? 'text-emerald-400' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent><div className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>{fmt(balance)}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="income" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="income">Receitas</TabsTrigger>
              <TabsTrigger value="expenses">Despesas</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 w-56 bg-card border-border" />
            </div>
          </div>

          <TabsContent value="income" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewIncome}><Plus className="mr-2 h-4 w-4" /> Nova Receita</Button>
            </div>
            <Card className="border-border bg-card">{renderTable(incomes, 'income')}</Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewExpense}><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Button>
            </div>
            <Card className="border-border bg-card">{renderTable(expenses, 'expense')}</Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Income Dialog */}
      <Dialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingIncome ? 'Editar Receita' : 'Nova Receita'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={iDesc} onChange={e => setIDesc(e.target.value)} placeholder="Ex: Aluguel apartamento" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor (R$)</Label><Input type="number" value={iAmt || ''} onChange={e => setIAmt(Number(e.target.value))} /></div>
              <div><Label>Categoria</Label>
                <Select value={iCat} onValueChange={setICat}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{incomeCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={iDate} onChange={e => setIDate(e.target.value)} /></div>
              <div><Label>Tipo</Label>
                <Select value={iRec} onValueChange={setIRec}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="one_time">Única</SelectItem><SelectItem value="recurring">Recorrente</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {iRec === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Dia fixo</Label><Input type="number" min="1" max="31" value={iRecDay} onChange={e => setIRecDay(e.target.value)} /></div>
                <div><Label>Data final</Label><Input type="date" value={iRecEnd} onChange={e => setIRecEnd(e.target.value)} /></div>
              </div>
            )}
            <div><Label>Status</Label>
              <Select value={iStatus} onValueChange={setIStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={iNotes} onChange={e => setINotes(e.target.value)} rows={2} /></div>
            <Button className="w-full" onClick={saveIncome} disabled={!iDesc || !iDate}>{editingIncome ? 'Salvar' : 'Criar Receita'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Ex: Conta de luz" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor (R$)</Label><Input type="number" value={eAmt || ''} onChange={e => setEAmt(Number(e.target.value))} /></div>
              <div><Label>Categoria</Label>
                <Select value={eCat} onValueChange={setECat}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={eDate} onChange={e => setEDate(e.target.value)} /></div>
              <div><Label>Tipo</Label>
                <Select value={eRec} onValueChange={setERec}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="one_time">Única</SelectItem><SelectItem value="recurring">Recorrente</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {eRec === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Dia fixo</Label><Input type="number" min="1" max="31" value={eRecDay} onChange={e => setERecDay(e.target.value)} /></div>
                <div><Label>Data final</Label><Input type="date" value={eRecEnd} onChange={e => setERecEnd(e.target.value)} /></div>
              </div>
            )}
            <div><Label>Status</Label>
              <Select value={eStatus} onValueChange={setEStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Comprovante</Label><Input type="file" onChange={e => setEAttachment(e.target.files?.[0] ?? null)} accept="image/*,.pdf" /></div>
            <div><Label>Observações</Label><Textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} /></div>
            <Button className="w-full" onClick={saveExpense} disabled={!eDesc || !eDate || uploading}>
              {uploading ? 'Enviando...' : editingExpense ? 'Salvar' : 'Criar Despesa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
