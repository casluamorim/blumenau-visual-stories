import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, ExternalLink, Trash2, Link2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ProjectLink = Database['public']['Tables']['project_links']['Row'];
type Stage = Database['public']['Tables']['project_stages']['Row'];

const typeLabels: Record<string, string> = {
  drive: 'Drive',
  arquivo: 'Arquivo',
  referencia: 'Referência',
  outro: 'Outro',
};

export function ProjectLinksPanel({
  projectId,
  links,
  stages,
  canEdit,
  onChange,
  defaultStageId,
  compact,
}: {
  projectId: string;
  links: ProjectLink[];
  stages: Stage[];
  canEdit: boolean;
  onChange: () => void;
  defaultStageId?: string | null;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    url: '',
    type: 'drive' as Database['public']['Enums']['project_link_type'],
    stage_id: defaultStageId ?? 'none',
  });

  async function addLink() {
    if (!form.title.trim() || !form.url.trim()) {
      toast({ title: 'Preencha título e link', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('project_links').insert({
      project_id: projectId,
      stage_id: form.stage_id === 'none' ? null : form.stage_id,
      title: form.title.trim(),
      url: form.url.trim(),
      type: form.type,
      added_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: 'Erro ao salvar link', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Link adicionado!' });
    setForm({ title: '', url: '', type: 'drive', stage_id: defaultStageId ?? 'none' });
    setOpen(false);
    onChange();
  }

  async function removeLink(id: string) {
    const { error } = await supabase.from('project_links').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    onChange();
  }

  const addButton = canEdit ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={compact ? 'ghost' : 'default'} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Link
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="text-foreground">Novo link</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-muted border-border" /></div>
          <div><Label>URL *</Label><Input placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="bg-muted border-border" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fase (opcional)</Label>
              <Select value={form.stage_id} onValueChange={v => setForm({ ...form, stage_id: v })}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Projeto (geral)</SelectItem>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addLink} className="w-full">Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  function LinkRow({ link }: { link: ProjectLink }) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{link.title}</p>
          <p className="truncate text-xs text-muted-foreground">{link.url}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{typeLabels[link.type] ?? link.type}</Badge>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 hover:bg-background">
          <ExternalLink className="h-4 w-4 text-foreground" />
        </a>
        {canEdit && (
          <button onClick={() => removeLink(link.id)} className="rounded p-1.5 hover:bg-background">
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Links da fase ({links.length})</p>
          {addButton}
        </div>
        {links.map(l => <LinkRow key={l.id} link={l} />)}
      </div>
    );
  }

  const general = links.filter(l => !l.stage_id);
  const grouped = stages
    .map(s => ({ stage: s, items: links.filter(l => l.stage_id === s.id) }))
    .filter(g => g.items.length > 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg text-foreground">Repositório de links</CardTitle>
        {addButton}
      </CardHeader>
      <CardContent className="space-y-5">
        {links.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum link cadastrado ainda.</p>
        )}
        {general.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geral do projeto</p>
            {general.map(l => <LinkRow key={l.id} link={l} />)}
          </div>
        )}
        {grouped.map(g => (
          <div key={g.stage.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.stage.name}</p>
            {g.items.map(l => <LinkRow key={l.id} link={l} />)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
