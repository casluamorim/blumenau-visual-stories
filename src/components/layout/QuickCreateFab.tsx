import { useEffect, useState } from 'react';
import { Plus, Users, FolderKanban, FileText, DollarSign, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

type EntityType = 'client' | 'project' | 'content' | 'invoice' | null;

export function QuickCreateFab() {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<EntityType>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const qc = useQueryClient();

  // Detect client_id from URL when on /clients/:id
  const clientIdFromRoute = (() => {
    const m = location.pathname.match(/^\/clients\/([0-9a-f-]+)/i);
    return m?.[1] ?? '';
  })();

  // Forms
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '' });
  const [projForm, setProjForm] = useState({ name: '', client_id: '', priority: 'medium', deadline: '', description: '', template_id: '' });
  const [contentForm, setContentForm] = useState({ title: '', client_id: '', project_id: '', type: 'photo', priority: 'medium', deadline: '' });
  const [invForm, setInvForm] = useState({ title: '', client_id: '', amount: '', due_date: '', notes: '' });

  useEffect(() => {
    if (!entity) return;
    (async () => {
      const [c, t] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('project_templates').select('*').order('name'),
      ]);
      setClients(c.data ?? []);
      setTemplates(t.data ?? []);

      // Pre-fill client when on a client route
      if (clientIdFromRoute) {
        setProjForm(f => ({ ...f, client_id: f.client_id || clientIdFromRoute }));
        setContentForm(f => ({ ...f, client_id: f.client_id || clientIdFromRoute }));
        setInvForm(f => ({ ...f, client_id: f.client_id || clientIdFromRoute }));
      }
    })();
  }, [entity, clientIdFromRoute]);

  // Load projects for selected client (content form)
  useEffect(() => {
    if (!contentForm.client_id) { setProjects([]); return; }
    supabase
      .from('projects')
      .select('id, name')
      .eq('client_id', contentForm.client_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []));
  }, [contentForm.client_id]);

  function reset() {
    setEntity(null);
    setClientForm({ name: '', company: '', email: '', phone: '' });
    setProjForm({ name: '', client_id: '', priority: 'medium', deadline: '', description: '', template_id: '' });
    setContentForm({ title: '', client_id: '', project_id: '', type: 'photo', priority: 'medium', deadline: '' });
    setInvForm({ title: '', client_id: '', amount: '', due_date: '', notes: '' });
  }

  function invalidate() {
    qc.invalidateQueries();
  }

  async function createClient() {
    if (!clientForm.name.trim()) return toast({ title: 'Nome é obrigatório', variant: 'destructive' });
    setSubmitting(true);
    const { error } = await supabase.from('clients').insert({ ...clientForm, status: 'active' });
    setSubmitting(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Cliente criado' });
    invalidate(); reset(); setOpen(false);
  }

  async function createProject() {
    if (!projForm.name.trim() || !projForm.client_id) return toast({ title: 'Preencha nome e cliente', variant: 'destructive' });
    setSubmitting(true);

    const tpl = templates.find(t => t.id === projForm.template_id);
    const { data: project, error } = await supabase.from('projects').insert({
      name: projForm.name,
      client_id: projForm.client_id,
      status: 'briefing',
      priority: (tpl?.default_priority ?? projForm.priority) as any,
      deadline: projForm.deadline || null,
      description: projForm.description || tpl?.description || null,
      created_by: user?.id,
    }).select('id').single();

    if (error || !project) {
      setSubmitting(false);
      return toast({ title: 'Erro', description: error?.message, variant: 'destructive' });
    }

    // Create default contents from template
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

    setSubmitting(false);
    toast({ title: tpl ? `Projeto criado a partir do template "${tpl.name}"` : 'Projeto criado' });
    invalidate(); reset(); setOpen(false);
  }

  async function createContent() {
    if (!contentForm.title.trim() || !contentForm.project_id) return toast({ title: 'Preencha título e projeto', variant: 'destructive' });
    setSubmitting(true);
    const { error } = await supabase.from('contents').insert({
      title: contentForm.title,
      project_id: contentForm.project_id,
      type: contentForm.type as any,
      priority: contentForm.priority as any,
      deadline: contentForm.deadline || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Conteúdo criado' });
    invalidate(); reset(); setOpen(false);
  }

  async function createInvoice() {
    if (!invForm.title.trim() || !invForm.client_id || !invForm.amount || !invForm.due_date) {
      return toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
    }
    setSubmitting(true);
    const { error } = await supabase.from('invoices').insert({
      title: invForm.title,
      client_id: invForm.client_id,
      amount: Number(invForm.amount),
      due_date: invForm.due_date,
      notes: invForm.notes || null,
      financial_type: 'pj',
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Fatura criada' });
    invalidate(); reset(); setOpen(false);
  }

  const options: { key: EntityType; label: string; icon: any }[] = [
    { key: 'client', label: 'Cliente', icon: Users },
    { key: 'project', label: 'Projeto', icon: FolderKanban },
    { key: 'content', label: 'Conteúdo', icon: FileText },
    { key: 'invoice', label: 'Fatura', icon: DollarSign },
  ];

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col gap-2 animate-fade-in">
            {options.map(opt => (
              <Button
                key={opt.key}
                size="sm"
                variant="secondary"
                className="shadow-lg"
                onClick={() => setEntity(opt.key)}
              >
                <opt.icon className="mr-2 h-4 w-4" />
                {opt.label}
              </Button>
            ))}
          </div>
        )}
        <Button
          size="icon"
          className={cn('h-14 w-14 rounded-full shadow-xl transition-transform', open && 'rotate-45')}
          onClick={() => setOpen(o => !o)}
          aria-label="Criação rápida"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      {/* Cliente */}
      <Dialog open={entity === 'client'} onOpenChange={o => !o && reset()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></div>
            <div><Label>Empresa</Label><Input value={clientForm.company} onChange={e => setClientForm({ ...clientForm, company: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></div>
            </div>
            <Button onClick={createClient} disabled={submitting} className="w-full">Criar cliente</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Projeto */}
      <Dialog open={entity === 'project'} onOpenChange={o => !o && reset()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={projForm.client_id} onValueChange={v => setProjForm({ ...projForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
            <Button onClick={createProject} disabled={submitting} className="w-full">Criar projeto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conteúdo */}
      <Dialog open={entity === 'content'} onOpenChange={o => !o && reset()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={contentForm.client_id} onValueChange={v => setContentForm({ ...contentForm, client_id: v, project_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto *</Label>
              <Select value={contentForm.project_id} onValueChange={v => setContentForm({ ...contentForm, project_id: v })} disabled={!contentForm.client_id}>
                <SelectTrigger><SelectValue placeholder={contentForm.client_id ? 'Selecione' : 'Escolha um cliente'} /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título *</Label><Input value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={contentForm.type} onValueChange={v => setContentForm({ ...contentForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="reels">Reels</SelectItem>
                    <SelectItem value="stories">Stories</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="cover">Capa</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={contentForm.deadline} onChange={e => setContentForm({ ...contentForm, deadline: e.target.value })} /></div>
            </div>
            <Button onClick={createContent} disabled={submitting} className="w-full">Criar conteúdo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fatura */}
      <Dialog open={entity === 'invoice'} onOpenChange={o => !o && reset()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={invForm.client_id} onValueChange={v => setInvForm({ ...invForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título *</Label><Input value={invForm.title} onChange={e => setInvForm({ ...invForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={invForm.due_date} onChange={e => setInvForm({ ...invForm, due_date: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} /></div>
            <Button onClick={createInvoice} disabled={submitting} className="w-full">Criar fatura</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
