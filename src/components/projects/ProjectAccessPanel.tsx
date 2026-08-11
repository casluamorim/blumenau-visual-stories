import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Trash2, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Access = Database['public']['Tables']['project_access']['Row'];
type AccessRole = Database['public']['Enums']['project_access_role'];

const roleLabels: Record<AccessRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  social_media: 'Social Media',
  visualizador: 'Visualizador',
  fotografo: 'Fotógrafo',
  gestor_anuncios: 'Gestor de Anúncios',
  designer: 'Designer',
  motion_designer: 'Motion Designer',
  roteirista: 'Roteirista',
  redator: 'Redator',
  produtor: 'Produtor',
};

export function ProjectAccessPanel({
  projectId,
  access,
  canManage,
  onChange,
}: {
  projectId: string;
  access: Access[];
  canManage: boolean;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState<{ user_id: string; full_name: string; email: string | null }[]>([]);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState<AccessRole>('editor');
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name, email').eq('is_active', true).order('full_name')
      .then(({ data }) => setPeople(data ?? []));
  }, []);

  async function addAccess() {
    if (!selected) { toast({ title: 'Escolha uma pessoa', variant: 'destructive' }); return; }
    const { error } = await supabase.from('project_access').insert({
      project_id: projectId,
      user_id: selected,
      role,
      can_edit: role === 'visualizador' ? false : canEdit,
      created_by: user?.id ?? null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Acesso liberado!' });
    setSelected('');
    onChange();
  }

  async function toggleEdit(row: Access, value: boolean) {
    const { error } = await supabase.from('project_access').update({ can_edit: value }).eq('id', row.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    onChange();
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_access').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    onChange();
  }

  const nameOf = (uid: string) => people.find(p => p.user_id === uid)?.full_name || 'Usuário';

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Quem tem acesso a este projeto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div>
              <Label>Pessoa</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {people
                    .filter(p => !access.some(a => a.user_id === p.user_id))
                    .map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger className="bg-muted border-border w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as AccessRole[]).map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={canEdit && role !== 'visualizador'} disabled={role === 'visualizador'} onCheckedChange={setCanEdit} />
              <span className="text-sm text-muted-foreground">Pode editar</span>
            </div>
            <Button onClick={addAccess}><UserPlus className="mr-1 h-4 w-4" /> Liberar</Button>
          </div>
        )}

        <div className="space-y-2">
          {access.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ninguém adicionado. Admins e responsáveis pelo cliente já têm acesso.
            </p>
          )}
          {access.map(a => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{nameOf(a.user_id)}</p>
              </div>
              <Badge variant="outline">{roleLabels[a.role]}</Badge>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <Switch checked={a.can_edit} onCheckedChange={v => toggleEdit(a, v)} />
                  <span className="text-xs text-muted-foreground">Editar</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{a.can_edit ? 'Pode editar' : 'Só leitura'}</span>
              )}
              {canManage && (
                <button onClick={() => remove(a.id)} className="rounded p-1.5 hover:bg-background">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
