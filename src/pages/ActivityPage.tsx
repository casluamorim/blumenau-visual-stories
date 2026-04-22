import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  Clock, UserPlus, UserCheck, UserX, Shield, Link2, Unlink, ArrowRightLeft, KeyRound, FileText, Search,
} from 'lucide-react';

interface LogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  details: any;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
}

const ACTION_META: Record<string, { label: string; Icon: any; tone: string }> = {
  'user.invited':           { label: 'Convidou usuário',         Icon: UserPlus,       tone: 'text-primary' },
  'user.invite_accepted':   { label: 'Aceitou convite',          Icon: UserCheck,      tone: 'text-emerald-500' },
  'user.activated':         { label: 'Ativou usuário',           Icon: UserCheck,      tone: 'text-emerald-500' },
  'user.deactivated':       { label: 'Desativou usuário',        Icon: UserX,          tone: 'text-amber-500' },
  'user.role_changed':      { label: 'Alterou função',           Icon: KeyRound,       tone: 'text-primary' },
  'assignment.created':     { label: 'Vinculou cliente',         Icon: Link2,          tone: 'text-emerald-500' },
  'assignment.removed':     { label: 'Removeu vínculo',          Icon: Unlink,         tone: 'text-destructive' },
  'assignment.level_changed':{ label: 'Alterou nível de acesso', Icon: ArrowRightLeft, tone: 'text-primary' },
};

const ENTITY_LABEL: Record<string, string> = {
  user: 'Usuário',
  client_assignment: 'Vínculo de cliente',
};

function formatDetails(action: string, details: any): string | null {
  if (!details || typeof details !== 'object') return null;
  switch (action) {
    case 'user.invited':
      return `${details.full_name ?? ''}${details.email ? ` (${details.email})` : ''} como ${details.role ?? '—'}`;
    case 'user.invite_accepted':
      return `${details.full_name ?? ''}${details.email ? ` (${details.email})` : ''}`;
    case 'user.activated':
    case 'user.deactivated':
      return details.full_name ?? details.email ?? null;
    case 'user.role_changed':
      return `${details.full_name ?? ''}: ${details.from ?? '—'} → ${details.to ?? '—'}`;
    case 'assignment.created':
      return `${details.user_name ?? ''} → ${details.client_name ?? ''} (${details.access_level ?? 'edit'})`;
    case 'assignment.removed':
      return `${details.user_name ?? ''} ✕ ${details.client_name ?? ''}`;
    case 'assignment.level_changed':
      return `${details.user_name ?? ''} em ${details.client_name ?? ''}: ${details.from ?? '—'} → ${details.to ?? '—'}`;
    default:
      return null;
  }
}

const ACTION_FILTERS = [
  { value: 'all', label: 'Todas as ações' },
  { value: 'user', label: 'Apenas usuários' },
  { value: 'assignment', label: 'Apenas vínculos' },
  { value: 'other', label: 'Outras' },
];

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('profiles').select('user_id, full_name, email, avatar_url'),
      ]);
      if (!mounted) return;
      const profMap: Record<string, Profile> = {};
      (profilesRes.data || []).forEach((p: any) => { profMap[p.user_id] = p; });
      setProfiles(profMap);
      setLogs((logsRes.data || []) as LogRow[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filter === 'user' && !l.action.startsWith('user.')) return false;
      if (filter === 'assignment' && !l.action.startsWith('assignment.')) return false;
      if (filter === 'other' && (l.action.startsWith('user.') || l.action.startsWith('assignment.'))) return false;
      if (search) {
        const q = search.toLowerCase();
        const author = l.user_id ? profiles[l.user_id]?.full_name?.toLowerCase() ?? '' : '';
        const summary = (formatDetails(l.action, l.details) || '').toLowerCase();
        if (!l.action.toLowerCase().includes(q) && !author.includes(q) && !summary.includes(q)) return false;
      }
      return true;
    });
  }, [logs, profiles, filter, search]);

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="page-title">Atividades</h1>
          <p className="text-muted-foreground">Histórico de ações da equipe — quem fez, o quê e quando</p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Linha do tempo</CardTitle>
              <CardDescription>Últimos {logs.length} registros</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por autor, ação ou detalhe…"
                  className="pl-8 w-full sm:w-72"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Nenhuma atividade encontrada.</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map(log => {
                  const meta = ACTION_META[log.action] || { label: log.action, Icon: FileText, tone: 'text-muted-foreground' };
                  const Icon = meta.Icon;
                  const author = log.user_id ? profiles[log.user_id] : null;
                  const summary = formatDetails(log.action, log.details);
                  return (
                    <li key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`mt-0.5 rounded-md bg-muted p-2 ${meta.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-foreground">
                            {author?.full_name || 'Sistema'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {meta.label.toLowerCase()}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {ENTITY_LABEL[log.entity_type] || log.entity_type}
                          </Badge>
                        </div>
                        {summary && (
                          <p className="text-sm text-muted-foreground truncate">{summary}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
