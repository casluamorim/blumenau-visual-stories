import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, X, ListChecks, FileStack } from 'lucide-react';

interface ChecklistItem { id: string; text: string }
interface DefaultContent { title: string; type: string; priority: string }

interface Template {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  checklist: ChecklistItem[];
  default_contents: DefaultContent[];
}

const CONTENT_TYPES = ['photo', 'video', 'reels', 'stories', 'carousel', 'cover', 'banner', 'other'];

export function TemplatesManager({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const [form, setForm] = useState<Template>({
    id: '', name: '', description: '', default_priority: 'medium', checklist: [], default_contents: [],
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('project_templates').select('*').order('name');
    setItems((data ?? []) as any);
    setLoading(false);
  }

  function reset() {
    setForm({ id: '', name: '', description: '', default_priority: 'medium', checklist: [], default_contents: [] });
    setEditing(null);
    setOpen(false);
  }

  function openEdit(tpl: Template) {
    setEditing(tpl);
    setForm({
      ...tpl,
      checklist: Array.isArray(tpl.checklist) ? tpl.checklist : [],
      default_contents: Array.isArray(tpl.default_contents) ? tpl.default_contents : [],
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast({ title: 'Nome é obrigatório', variant: 'destructive' });
    const payload = {
      name: form.name,
      description: form.description || null,
      default_priority: form.default_priority as any,
      checklist: form.checklist as any,
      default_contents: form.default_contents as any,
    };
    if (editing) {
      const { error } = await supabase.from('project_templates').update(payload).eq('id', editing.id);
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      toast({ title: 'Template atualizado' });
    } else {
      const { error } = await supabase.from('project_templates').insert({ ...payload, created_by: user?.id });
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      toast({ title: 'Template criado' });
    }
    reset(); load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir template?')) return;
    const { error } = await supabase.from('project_templates').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Template removido' });
    load();
  }

  function addChecklistItem() {
    setForm({ ...form, checklist: [...form.checklist, { id: crypto.randomUUID(), text: '' }] });
  }
  function updateChecklistItem(idx: number, text: string) {
    const next = [...form.checklist]; next[idx] = { ...next[idx], text };
    setForm({ ...form, checklist: next });
  }
  function removeChecklistItem(idx: number) {
    setForm({ ...form, checklist: form.checklist.filter((_, i) => i !== idx) });
  }

  function addContent() {
    setForm({ ...form, default_contents: [...form.default_contents, { title: '', type: 'photo', priority: 'medium' }] });
  }
  function updateContent(idx: number, patch: Partial<DefaultContent>) {
    const next = [...form.default_contents]; next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, default_contents: next });
  }
  function removeContent(idx: number) {
    setForm({ ...form, default_contents: form.default_contents.filter((_, i) => i !== idx) });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Templates de projeto</CardTitle>
          <CardDescription>Modelos para criar projetos padronizados com checklist e conteúdos pré-definidos</CardDescription>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Novo template</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Lançamento de campanha" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div>
                  <Label>Prioridade padrão</Label>
                  <Select value={form.default_priority} onValueChange={v => setForm({ ...form, default_priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Checklist padrão</Label>
                    <Button size="sm" variant="outline" onClick={addChecklistItem}><Plus className="h-3 w-3 mr-1" />Item</Button>
                  </div>
                  <div className="space-y-2">
                    {form.checklist.map((item, i) => (
                      <div key={item.id} className="flex gap-2">
                        <Input value={item.text} onChange={e => updateChecklistItem(i, e.target.value)} placeholder="Descrição da etapa" />
                        <Button size="icon" variant="ghost" onClick={() => removeChecklistItem(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {form.checklist.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item.</p>}
                  </div>
                </div>

                {/* Default Contents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2"><FileStack className="h-4 w-4" /> Conteúdos padrão</Label>
                    <Button size="sm" variant="outline" onClick={addContent}><Plus className="h-3 w-3 mr-1" />Conteúdo</Button>
                  </div>
                  <div className="space-y-2">
                    {form.default_contents.map((c, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-6" value={c.title} onChange={e => updateContent(i, { title: e.target.value })} placeholder="Título" />
                        <Select value={c.type} onValueChange={v => updateContent(i, { type: v })}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={c.priority} onValueChange={v => updateContent(i, { priority: v })}>
                          <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeContent(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {form.default_contents.length === 0 && <p className="text-xs text-muted-foreground">Nenhum conteúdo padrão.</p>}
                  </div>
                </div>

                <Button onClick={save} className="w-full">{editing ? 'Salvar' : 'Criar template'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template ainda. {isAdmin && 'Crie o primeiro acima.'}</p>
        ) : (
          <div className="space-y-2">
            {items.map(tpl => (
              <div key={tpl.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tpl.name}</p>
                  {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{(tpl.checklist?.length ?? 0)} itens checklist</Badge>
                    <Badge variant="outline" className="text-xs">{(tpl.default_contents?.length ?? 0)} conteúdos</Badge>
                    <Badge variant="outline" className="text-xs">Prioridade: {tpl.default_priority}</Badge>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(tpl)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(tpl.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
