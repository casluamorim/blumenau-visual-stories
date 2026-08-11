import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStageFlowPresets, type FlowPreset } from '@/hooks/useStageFlowPresets';
import { STAGE_ROLE_LABELS, type StageFlowItem } from '@/lib/projectTiming';
import { Plus, Trash2, Edit, X, Workflow, ArrowUp, ArrowDown } from 'lucide-react';

function slugKey(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_+|_+$)/g, '');
}

const emptyForm = (): FlowPreset => ({
  id: '', key: '', label: '', description: '', stages: [], is_active: true, order_index: 99,
});

export function FlowPresetsManager({ isAdmin }: { isAdmin: boolean }) {
  const { presets, loading, reload } = useStageFlowPresets(false);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FlowPreset | null>(null);
  const [form, setForm] = useState<FlowPreset>(emptyForm());

  function reset() {
    setForm(emptyForm());
    setEditing(null);
    setOpen(false);
  }

  function openEdit(p: FlowPreset) {
    setEditing(p);
    setForm({ ...p, stages: [...(p.stages ?? [])] });
    setOpen(true);
  }

  async function save() {
    if (!form.label.trim()) return toast({ title: 'Informe o nome do fluxo', variant: 'destructive' });
    const payload = {
      key: (form.key || slugKey(form.label)) as string,
      label: form.label.trim(),
      description: form.description || null,
      stages: form.stages as any,
      is_active: form.is_active,
      order_index: Number(form.order_index) || 0,
    };
    const q = editing
      ? supabase.from('stage_flow_presets' as any).update(payload).eq('id', editing.id)
      : supabase.from('stage_flow_presets' as any).insert(payload);
    const { error } = await q;
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: editing ? 'Fluxo atualizado' : 'Fluxo criado' });
    reset();
    reload();
  }

  async function remove(p: FlowPreset) {
    if (!confirm(`Excluir o fluxo "${p.label}"?`)) return;
    const { error } = await supabase.from('stage_flow_presets' as any).delete().eq('id', p.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Fluxo removido' });
    reload();
  }

  async function toggleActive(p: FlowPreset, value: boolean) {
    const { error } = await supabase.from('stage_flow_presets' as any).update({ is_active: value }).eq('id', p.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    reload();
  }

  function updStage(idx: number, patch: Partial<StageFlowItem>) {
    const next = [...form.stages];
    next[idx] = { ...next[idx], ...patch } as StageFlowItem;
    setForm({ ...form, stages: next });
  }
  function move(idx: number, dir: -1 | 1) {
    const next = [...form.stages];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm({ ...form, stages: next });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" /> Fluxos de trabalho</CardTitle>
          <CardDescription>
            Presets de fases por área (audiovisual, social media, fotografia, anúncios...). Usados na criação de projetos.
          </CardDescription>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={o => { if (!o) reset(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Novo fluxo</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} fluxo de trabalho</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex.: Fotografia de produto" />
                  </div>
                  <div>
                    <Label>Ordem</Label>
                    <Input type="number" value={form.order_index} onChange={e => setForm({ ...form, order_index: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                  <Label className="mb-0">Fluxo ativo (aparece na criação de projetos)</Label>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Fases do fluxo</Label>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, stages: [...form.stages, { name: '', assigned_role: 'editor', expected_duration_hours: 4 }] })}>
                      <Plus className="mr-1 h-3 w-3" />Fase
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.stages.map((s, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-2">
                        <Input className="col-span-5" value={s.name} placeholder="Nome da fase" onChange={e => updStage(i, { name: e.target.value })} />
                        <Select value={(s.assigned_role as string) ?? 'editor'} onValueChange={(v: any) => updStage(i, { assigned_role: v })}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STAGE_ROLE_LABELS).map(([k, label]) => (
                              <SelectItem key={k} value={k}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="col-span-2"
                          type="number"
                          min={0}
                          placeholder="horas"
                          value={s.expected_duration_hours ?? ''}
                          onChange={e => updStage(i, { expected_duration_hours: e.target.value ? Number(e.target.value) : null })}
                        />
                        <div className="col-span-2 flex justify-end">
                          <Button size="icon" variant="ghost" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, stages: form.stages.filter((_, j) => j !== i) })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {form.stages.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma fase ainda.</p>}
                  </div>
                </div>

                <Button onClick={save} className="w-full">{editing ? 'Salvar fluxo' : 'Criar fluxo'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {presets.map(p => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.label}</p>
                    <Badge variant="outline" className="text-xs">{p.stages?.length ?? 0} fases</Badge>
                    {!p.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(p.stages ?? []).map(s => s.name).join(' → ')}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Switch checked={p.is_active} onCheckedChange={v => toggleActive(p, v)} />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}
            {presets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum fluxo cadastrado.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
