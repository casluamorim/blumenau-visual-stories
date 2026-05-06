import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Building2, Mail, Phone, Plus, FolderKanban, FileText, DollarSign, Activity, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const projectStatus: Record<string, { label: string; color: string }> = {
  briefing: { label: 'Briefing', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  in_progress: { label: 'Em Andamento', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  review: { label: 'Revisão', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  completed: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  paused: { label: 'Pausado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const contentStatus: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  in_review: { label: 'Em Revisão', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  revision: { label: 'Correção', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  approved: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  published: { label: 'Publicado', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

const invoiceStatus: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  overdue: { label: 'Atrasado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

const typeLabels: Record<string, string> = {
  photo: 'Foto', video: 'Vídeo', reels: 'Reels', stories: 'Stories',
  carousel: 'Carrossel', cover: 'Capa', banner: 'Banner', other: 'Outro',
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-create dialogs
  const [projDlg, setProjDlg] = useState(false);
  const [contentDlg, setContentDlg] = useState(false);
  const [invDlg, setInvDlg] = useState(false);

  const [projForm, setProjForm] = useState({ name: '', priority: 'medium', deadline: '', description: '', template_id: '' });
  const [contentForm, setContentForm] = useState({ title: '', type: 'photo', priority: 'medium', deadline: '', project_id: '' });
  const [invForm, setInvForm] = useState({ title: '', amount: '', due_date: '', notes: '' });
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => { if (id) loadAll(); }, [id]);
  useEffect(() => {
    supabase.from('project_templates').select('*').order('name').then(({ data }) => setTemplates(data ?? []));
  }, []);

  async function loadAll() {
    setLoading(true);
    const [c, p, inv] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id!).maybeSingle(),
      supabase.from('projects').select('*').eq('client_id', id!).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id!).order('due_date', { ascending: false }),
    ]);
    setClient(c.data);
    setProjects(p.data ?? []);
    setInvoices(inv.data ?? []);

    const projectIds = (p.data ?? []).map((x: any) => x.id);
    if (projectIds.length) {
      const { data: ct } = await supabase
        .from('contents')
        .select('*, projects(name)')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      setContents(ct ?? []);
    } else {
      setContents([]);
    }

    const { data: lg } = await supabase
      .from('activity_logs')
      .select('*')
      .or(`entity_id.eq.${id},details->>client_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs(lg ?? []);
    setLoading(false);
  }

  async function createProject() {
    if (!projForm.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    const tpl = templates.find(t => t.id === projForm.template_id);
    const { data: project, error } = await supabase.from('projects').insert({
      name: projForm.name,
      client_id: id!,
      status: 'briefing',
      priority: (tpl?.default_priority ?? projForm.priority) as any,
      deadline: projForm.deadline || null,
      description: projForm.description || tpl?.description || null,
      created_by: user?.id,
    }).select('id').single();
    if (error || !project) { toast({ title: 'Erro', description: error?.message, variant: 'destructive' }); return; }
    if (tpl?.default_contents?.length) {
      const rows = (tpl.default_contents as any[]).map((c: any) => ({
        project_id: project.id,
        title: c.title,
        type: (c.type ?? 'other') as any,
        priority: (c.priority ?? 'medium') as any,
        checklist: tpl.checklist ?? [],
        created_by: user?.id,
      }));
      await supabase.from('contents').insert(rows);
    }
    toast({ title: tpl ? `Projeto criado a partir de "${tpl.name}"` : 'Projeto criado!' });
    setProjForm({ name: '', priority: 'medium', deadline: '', description: '', template_id: '' });
    setProjDlg(false);
    loadAll();
  }

  async function createContent() {
    if (!contentForm.title.trim() || !contentForm.project_id) {
      toast({ title: 'Preencha título e projeto', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('contents').insert({
      title: contentForm.title,
      type: contentForm.type as any,
      priority: contentForm.priority as any,
      deadline: contentForm.deadline || null,
      project_id: contentForm.project_id,
      created_by: user?.id,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Conteúdo criado!' });
    setContentForm({ title: '', type: 'photo', priority: 'medium', deadline: '', project_id: '' });
    setContentDlg(false);
    loadAll();
  }

  async function createInvoice() {
    if (!invForm.title.trim() || !invForm.amount || !invForm.due_date) {
      toast({ title: 'Preencha título, valor e vencimento', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('invoices').insert({
      title: invForm.title,
      amount: Number(invForm.amount),
      due_date: invForm.due_date,
      client_id: id!,
      notes: invForm.notes || null,
      financial_type: 'pj',
      created_by: user?.id,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Fatura criada!' });
    setInvForm({ title: '', amount: '', due_date: '', notes: '' });
    setInvDlg(false);
    loadAll();
  }

  const totals = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
    const pending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
    return { paid, pending, overdue };
  }, [invoices]);

  if (loading || !client) {
    return <AppLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div></AppLayout>;
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/clients"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                {client.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{client.company}</span>}
                {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
                {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
              </div>
            </div>
          </div>
          {/* Quick-create */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setProjDlg(true)}><Plus className="mr-1 h-4 w-4" />Projeto</Button>
            <Button size="sm" variant="outline" onClick={() => setContentDlg(true)} disabled={projects.length === 0} title={projects.length === 0 ? 'Crie um projeto primeiro' : ''}>
              <Plus className="mr-1 h-4 w-4" />Conteúdo
            </Button>
            <Button size="sm" onClick={() => setInvDlg(true)}><Plus className="mr-1 h-4 w-4" />Fatura</Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="projects">Projetos</TabsTrigger>
            <TabsTrigger value="contents">Conteúdos</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="activity">Atividades</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Projetos</p><p className="text-2xl font-bold">{projects.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conteúdos</p><p className="text-2xl font-bold">{contents.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-emerald-400">{fmt(totals.paid)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">A receber</p><p className="text-2xl font-bold text-amber-400">{fmt(totals.pending + totals.overdue)}</p></CardContent></Card>
            </div>
            {client.notes && (
              <Card>
                <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p></CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PROJECTS */}
          <TabsContent value="projects" className="mt-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(p => {
                const s = projectStatus[p.status] ?? { label: p.status, color: '' };
                return (
                  <Card key={p.id} className="border-border bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-base truncate">{p.name}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <Badge variant="outline" className={s.color}>{s.label}</Badge>
                      <Link to={`/projects/${p.id}`}>
                        <Button variant="ghost" size="sm" className="w-full">Abrir <ArrowRight className="ml-2 h-4 w-4" /></Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
              {projects.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">Nenhum projeto. Crie o primeiro acima.</p>}
            </div>
          </TabsContent>

          {/* CONTENTS */}
          <TabsContent value="contents" className="mt-6">
            <div className="space-y-2">
              {contents.map(c => {
                const s = contentStatus[c.status] ?? { label: c.status, color: '' };
                return (
                  <Card key={c.id} className="border-border bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.projects?.name} · {typeLabels[c.type] ?? c.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={s.color}>{s.label}</Badge>
                        <Link to={`/projects/${c.project_id}`}><Button variant="ghost" size="sm">Abrir</Button></Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {contents.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum conteúdo ainda.</p>}
            </div>
          </TabsContent>

          {/* FINANCIAL */}
          <TabsContent value="financial" className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold text-emerald-400">{fmt(totals.paid)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-xl font-bold text-amber-400">{fmt(totals.pending)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-xl font-bold text-red-400">{fmt(totals.overdue)}</p></CardContent></Card>
            </div>
            <div className="space-y-2">
              {invoices.map(inv => {
                const s = invoiceStatus[inv.status] ?? { label: inv.status, color: '' };
                return (
                  <Card key={inv.id} className="border-border bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{inv.title}</p>
                        <p className="text-xs text-muted-foreground">Vencimento: {format(new Date(inv.due_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{fmt(Number(inv.amount))}</span>
                        <Badge variant="outline" className={s.color}>{s.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {invoices.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma fatura.</p>}
            </div>
            <Link to="/financial"><Button variant="outline" size="sm"><DollarSign className="mr-2 h-4 w-4" />Abrir financeiro completo</Button></Link>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="mt-6">
            <div className="space-y-2">
              {logs.map(l => (
                <Card key={l.id} className="border-border bg-card">
                  <CardContent className="flex items-start justify-between p-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><Activity className="inline h-3 w-3 mr-1" />{l.action}</p>
                      {l.details && Object.keys(l.details).length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{JSON.stringify(l.details)}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString('pt-BR')}</span>
                  </CardContent>
                </Card>
              ))}
              {logs.length === 0 && <p className="py-8 text-center text-muted-foreground">Sem atividades registradas para este cliente.</p>}
            </div>
            <div className="mt-3">
              <Link to="/activity"><Button variant="outline" size="sm">Ver histórico completo</Button></Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick-create: Project */}
      <Dialog open={projDlg} onOpenChange={setProjDlg}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo projeto · {client.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {templates.length > 0 && (
              <div>
                <Label>Template (opcional)</Label>
                <Select value={projForm.template_id || 'none'} onValueChange={v => setProjForm({ ...projForm, template_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem template</SelectItem>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Nome *</Label><Input value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={projForm.priority} onValueChange={v => setProjForm({ ...projForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={projForm.deadline} onChange={e => setProjForm({ ...projForm, deadline: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={projForm.description} onChange={e => setProjForm({ ...projForm, description: e.target.value })} /></div>
            <Button className="w-full" onClick={createProject}>Criar projeto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-create: Content */}
      <Dialog open={contentDlg} onOpenChange={setContentDlg}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo conteúdo · {client.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto *</Label>
              <Select value={contentForm.project_id} onValueChange={v => setContentForm({ ...contentForm, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título *</Label><Input value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={contentForm.type} onValueChange={v => setContentForm({ ...contentForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={contentForm.deadline} onChange={e => setContentForm({ ...contentForm, deadline: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={createContent}>Criar conteúdo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-create: Invoice */}
      <Dialog open={invDlg} onOpenChange={setInvDlg}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova fatura · {client.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={invForm.title} onChange={e => setInvForm({ ...invForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={invForm.due_date} onChange={e => setInvForm({ ...invForm, due_date: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={createInvoice}>Criar fatura</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
