import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface TagItem { id: string; name: string; color: string; }

const presetColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

export function TagsManager() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('tags').select('*').order('name');
    setTags(data ?? []);
  }

  async function save() {
    if (!name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    if (editing) {
      await supabase.from('tags').update({ name, color }).eq('id', editing.id);
      toast({ title: 'Tag atualizada' });
    } else {
      await supabase.from('tags').insert({ name, color });
      toast({ title: 'Tag criada' });
    }
    reset(); load();
  }

  async function remove(id: string) {
    await supabase.from('tags').delete().eq('id', id);
    toast({ title: 'Tag removida' });
    load();
  }

  function openEdit(t: TagItem) { setEditing(t); setName(t.name); setColor(t.color); setOpen(true); }
  function reset() { setEditing(null); setName(''); setColor('#6366f1'); setOpen(false); }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Crie, edite e gerencie as tags usadas em clientes, projetos, conteúdos, faturas e despesas</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={o => { if (!o) reset(); setOpen(o); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nova Tag</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Tag</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div>
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {presetColors.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={save} className="w-full">{editing ? 'Salvar' : 'Criar Tag'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 group">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="font-medium">{tag.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tag)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(tag.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {tags.length === 0 && <div className="col-span-full py-8 text-center text-muted-foreground">Nenhuma tag criada.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
