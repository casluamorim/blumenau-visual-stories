import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, FolderKanban, FileText, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  pendingContents: number;
  approvedContents: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeProjects: 0,
    pendingContents: 0,
    approvedContents: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
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
    loadStats();
  }, []);

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
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da operação da Racun</p>
        </div>

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
                    <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
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

function Activity(props: any) {
  return <Clock {...props} />;
}
