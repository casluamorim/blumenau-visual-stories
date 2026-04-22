import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, FolderKanban, FileText, CheckCircle, Clock,
  AlertTriangle, AlertOctagon, CalendarClock, RotateCcw, TrendingDown
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  pendingContents: number;
  approvedContents: number;
}

interface Alert {
  id: string;
  type: 'overdue' | 'revision_limit' | 'stale_client' | 'overdue_invoice';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  link?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0, activeProjects: 0, pendingContents: 0, approvedContents: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    loadStats();
    loadAlerts();
  }, []);

  async function loadStats() {
    const [clients, projects, pendingContents, approvedContents, activity] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['in_progress', 'review']),
      supabase.from('contents').select('id', { count: 'exact', head: true }).in('status', ['in_review', 'draft']),
      supabase.from('contents').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    setStats({
      totalClients: clients.count ?? 0,
      activeProjects: projects.count ?? 0,
      pendingContents: pendingContents.count ?? 0,
      approvedContents: approvedContents.count ?? 0,
    });
    setRecentActivity(activity.data ?? []);
  }

  async function loadAlerts() {
    const newAlerts: Alert[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Overdue contents (deadline passed, not approved/published)
    const { data: overdueContents } = await supabase
      .from('contents')
      .select('id, title, deadline, project_id, projects(name)')
      .lt('deadline', today)
      .not('status', 'in', '("approved","published")')
      .not('deadline', 'is', null)
      .limit(20);

    for (const c of overdueContents ?? []) {
      const proj = (c as any).projects;
      newAlerts.push({
        id: `overdue-${c.id}`,
        type: 'overdue',
        severity: 'critical',
        title: `"${c.title}" com prazo vencido`,
        description: `Projeto: ${proj?.name ?? '—'} • Prazo: ${new Date(c.deadline!).toLocaleDateString('pt-BR')}`,
        link: `/projects/${c.project_id}`,
      });
    }

    // 2. Overdue projects
    const { data: overdueProjects } = await supabase
      .from('projects')
      .select('id, name, deadline, clients(name)')
      .lt('deadline', today)
      .not('status', 'in', '("completed","cancelled")')
      .not('deadline', 'is', null)
      .limit(20);

    for (const p of overdueProjects ?? []) {
      const client = (p as any).clients;
      newAlerts.push({
        id: `overdue-proj-${p.id}`,
        type: 'overdue',
        severity: 'critical',
        title: `Projeto "${p.name}" atrasado`,
        description: `Cliente: ${client?.name ?? '—'} • Prazo: ${new Date(p.deadline!).toLocaleDateString('pt-BR')}`,
        link: `/projects/${p.id}`,
      });
    }

    // 3. Contents at revision limit
    const { data: revisionContents } = await supabase
      .from('contents')
      .select('id, title, revision_count, revision_limit, project_id, projects(name)')
      .not('status', 'in', '("approved","published")')
      .not('revision_count', 'is', null)
      .not('revision_limit', 'is', null)
      .limit(50);

    for (const c of revisionContents ?? []) {
      if ((c.revision_count ?? 0) >= (c.revision_limit ?? 3)) {
        const proj = (c as any).projects;
        newAlerts.push({
          id: `revision-${c.id}`,
          type: 'revision_limit',
          severity: 'warning',
          title: `"${c.title}" atingiu limite de revisões`,
          description: `${c.revision_count}/${c.revision_limit} revisões • Projeto: ${proj?.name ?? '—'}`,
          link: `/projects/${c.project_id}`,
        });
      }
    }

    // 4. Stale clients (active clients with no project updated in 30+ days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: activeClients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')
      .limit(100);

    for (const client of activeClients ?? []) {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .gte('updated_at', thirtyDaysAgo);

      if ((count ?? 0) === 0) {
        newAlerts.push({
          id: `stale-${client.id}`,
          type: 'stale_client',
          severity: 'warning',
          title: `Cliente "${client.name}" sem atividade`,
          description: 'Nenhum projeto atualizado nos últimos 30 dias',
          link: '/clients',
        });
      }
    }

    // 5. Overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, title, due_date, amount, clients(name)')
      .eq('status', 'pending')
      .lt('due_date', today)
      .limit(20);

    for (const inv of overdueInvoices ?? []) {
      const client = (inv as any).clients;
      newAlerts.push({
        id: `invoice-${inv.id}`,
        type: 'overdue_invoice',
        severity: 'critical',
        title: `Fatura "${inv.title}" vencida`,
        description: `${client?.name ?? '—'} • ${Number(inv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Venceu em ${new Date(inv.due_date).toLocaleDateString('pt-BR')}`,
        link: '/financial',
      });
    }

    // Sort: critical first
    newAlerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
    setAlerts(newAlerts);
  }

  const alertIcons: Record<string, any> = {
    overdue: CalendarClock,
    revision_limit: RotateCcw,
    stale_client: TrendingDown,
    overdue_invoice: AlertOctagon,
  };

  const statCards = [
    { label: 'Clientes Ativos', value: stats.totalClients, icon: Users, color: 'text-blue-400' },
    { label: 'Projetos em Andamento', value: stats.activeProjects, icon: FolderKanban, color: 'text-purple-400' },
    { label: 'Conteúdos Pendentes', value: stats.pendingContents, icon: FileText, color: 'text-amber-400' },
    { label: 'Aprovados', value: stats.approvedContents, icon: CheckCircle, color: 'text-emerald-400' },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da operação da Racun</p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Alertas de Gargalo ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map(alert => {
                const Icon = alertIcons[alert.type] ?? AlertTriangle;
                return (
                  <Link key={alert.id} to={alert.link ?? '#'} className="block">
                    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                      alert.severity === 'critical'
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                    }`}>
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                        alert.severity === 'critical' ? 'text-destructive' : 'text-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${
                            alert.severity === 'critical'
                              ? 'border-destructive/30 text-destructive'
                              : 'border-amber-500/30 text-amber-500'
                          }`}>
                            {alert.severity === 'critical' ? 'Crítico' : 'Atenção'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma atividade registrada ainda. Comece criando um cliente ou projeto!
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
