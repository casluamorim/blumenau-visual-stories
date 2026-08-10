import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, CheckCheck, Clock, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Notification = Database['public']['Tables']['notifications']['Row'];

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  stage_completed: { label: 'Fase concluída', icon: CheckCircle2, color: 'text-emerald-400' },
  deadline_near: { label: 'Prazo próximo', icon: Clock, color: 'text-amber-400' },
  overdue: { label: 'Prazo estourado', icon: AlertTriangle, color: 'text-red-400' },
  stalled: { label: 'Fase parada', icon: AlertTriangle, color: 'text-amber-400' },
};

export function NotificationsHistory({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [stages, setStages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [fProject, setFProject] = useState<string>(projectId ?? 'all');
  const [fStage, setFStage] = useState('all');
  const [fType, setFType] = useState('all');
  const [fRead, setFRead] = useState('all');

  async function load() {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(300);
    if (projectId) query = query.eq('project_id', projectId);
    const { data } = await query;
    const rows = data ?? [];
    setItems(rows);

    const pIds = Array.from(new Set(rows.map(r => r.project_id).filter(Boolean) as string[]));
    const sIds = Array.from(new Set(rows.map(r => r.stage_id).filter(Boolean) as string[]));
    if (pIds.length) {
      const { data: ps } = await supabase.from('projects').select('id, name').in('id', pIds);
      setProjects(Object.fromEntries((ps ?? []).map(p => [p.id, p.name])));
    }
    if (sIds.length) {
      const { data: ss } = await supabase.from('project_stages').select('id, name').in('id', sIds);
      setStages(Object.fromEntries((ss ?? []).map(s => [s.id, s.name])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectId]);

  const filtered = useMemo(
    () =>
      items.filter(n => {
        if (fProject !== 'all' && n.project_id !== fProject) return false;
        if (fStage !== 'all' && n.stage_id !== fStage) return false;
        if (fType !== 'all' && n.type !== fType) return false;
        if (fRead === 'unread' && n.read) return false;
        if (fRead === 'read' && !n.read) return false;
        return true;
      }),
    [items, fProject, fStage, fType, fRead],
  );

  const stageOptions = useMemo(() => {
    const ids = Array.from(
      new Set(
        items
          .filter(n => fProject === 'all' || n.project_id === fProject)
          .map(n => n.stage_id)
          .filter(Boolean) as string[],
      ),
    );
    return ids.map(id => ({ id, name: stages[id] ?? 'Fase' }));
  }, [items, fProject, stages]);

  const unreadCount = filtered.filter(n => !n.read).length;

  async function markRead(id: string, value = true) {
    await supabase.from('notifications').update({ read: value }).eq('id', id);
    load();
  }

  async function markAllVisibleRead() {
    const ids = filtered.filter(n => !n.read).map(n => n.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    load();
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-lg text-foreground">
          Histórico de notificações {filtered.length > 0 && <span className="text-sm text-muted-foreground">({filtered.length})</span>}
        </CardTitle>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllVisibleRead}>
            <CheckCheck className="mr-1 h-4 w-4" /> Marcar {unreadCount} como lidas
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {!projectId && (
            <div>
              <Label className="text-xs">Projeto</Label>
              <Select value={fProject} onValueChange={v => { setFProject(v); setFStage('all'); }}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {Object.entries(projects).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Fase</Label>
            <Select value={fStage} onValueChange={setFStage}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fases</SelectItem>
                {stageOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(typeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Situação</Label>
            <Select value={fRead} onValueChange={setFRead}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">Não lidas</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma notificação com esses filtros.</p>
          )}
          {filtered.map(n => {
            const cfg = typeConfig[n.type] ?? { label: n.type, icon: Bell, color: 'text-muted-foreground' };
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={`flex flex-wrap items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 ${n.read ? 'opacity-60' : ''}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                    {n.project_id && projects[n.project_id] && !projectId && (
                      <Badge variant="outline" className="text-[10px]">{projects[n.project_id]}</Badge>
                    )}
                    {n.stage_id && stages[n.stage_id] && (
                      <Badge variant="outline" className="text-[10px]">{stages[n.stage_id]}</Badge>
                    )}
                  </div>
                  {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {n.project_id && !projectId && (
                    <Link to={`/projects/${n.project_id}`}>
                      <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => markRead(n.id, !n.read)}>
                    {n.read ? 'Marcar não lida' : 'Marcar lida'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
