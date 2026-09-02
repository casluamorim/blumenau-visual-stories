import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Clock, CalendarDays, Play, CheckCircle2 } from 'lucide-react';
import { calculateProjectTiming, formatDuration, STAGE_STATUS_CONFIG } from '@/lib/projectTiming';
import { DeliveryPaymentDialog } from '@/components/finance/ProjectPaymentDialogs';
import { completeProject, createReceivableForProject } from '@/lib/quoteAutomation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCachedState, hasPageCache } from '@/hooks/useCachedState';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & { clients: { name: string; company: string | null } | null };
type Stage = Database['public']['Tables']['project_stages']['Row'];

export default function MyWork() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useCachedState<Project[]>('mywork:projects', []);
  const [stages, setStages] = useCachedState<Stage[]>('mywork:stages', []);
  const [loading, setLoading] = useState(!hasPageCache('mywork:projects'));
  const [payTarget, setPayTarget] = useState<Project | null>(null);

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function finishProject(project: Project) {
    if ((project as any).payment_trigger === 'on_delivery') {
      setPayTarget(project);
      return;
    }
    await completeProject(project.id, user?.id);
    toast({ title: 'Projeto finalizado' });
    load();
  }

  async function confirmDeliveryPayment(amount: number, date: string) {
    if (!payTarget) return;
    const { error } = await createReceivableForProject({
      clientId: payTarget.client_id,
      projectId: payTarget.id,
      quoteId: (payTarget as any).quote_id ?? null,
      title: payTarget.name,
      amount,
      dueDate: date,
      userId: user?.id,
    });
    if (error) {
      toast({ title: 'Erro ao lançar no Financeiro', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('projects').update({ payment_pending: false } as any).eq('id', payTarget.id);
    await completeProject(payTarget.id, user?.id);
    setPayTarget(null);
    toast({ title: 'Projeto finalizado', description: 'Recebimento lançado no Financeiro PJ.' });
    load();
  }


  async function load() {
    setLoading(true);
    // RLS já limita aos projetos que a pessoa pode ver
    const { data: projs } = await supabase
      .from('projects')
      .select('*, clients(name, company)')
      .not('status', 'in', '(completed,cancelled)')
      .order('deadline', { ascending: true, nullsFirst: false });

    const ids = (projs ?? []).map(p => p.id);
    let st: Stage[] = [];
    if (ids.length) {
      const { data } = await supabase.from('project_stages').select('*').in('project_id', ids).order('order_index');
      st = data ?? [];
    }
    setProjects((projs as any) ?? []);
    setStages(st);
    setLoading(false);
  }

  const mine = projects.filter(p => {
    const ps = stages.filter(s => s.project_id === p.id);
    if (!ps.length) return false;
    if (role === 'admin' || role === 'manager') return true;
    return ps.some(s => s.assigned_to === user?.id || (s.assigned_role && s.assigned_role === role));
  });

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="page-title">Meu Trabalho</h1>
          <p className="text-muted-foreground">Projetos e fases atribuídos a você</p>
        </div>

        {loading && <div className="py-12 text-center text-muted-foreground">Carregando...</div>}

        {!loading && mine.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhuma fase atribuída a você no momento.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {mine.map(project => {
            const ps = stages.filter(s => s.project_id === project.id);
            const timing = calculateProjectTiming(project, ps);
            const current = timing.currentStage;
            const isMineNow = current && (current.assigned_to === user?.id || current.assigned_role === role || role === 'admin');
            const done = ps.filter(s => s.status === 'completed');

            return (
              <Card key={project.id} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg text-foreground">{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {project.clients?.company || project.clients?.name}
                      </p>
                    </div>
                    <Badge variant="outline" className={timing.levelClass}>{timing.levelLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{timing.completedStages}/{timing.totalStages} fases</span>
                      <span>{timing.progressPercent}%</span>
                    </div>
                    <Progress value={timing.progressPercent} className="h-2" />
                  </div>

                  {current && (
                    <div className={`rounded-lg border p-3 ${isMineNow ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/40'}`}>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fase atual</p>
                      <p className="font-medium text-foreground">{current.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className={STAGE_STATUS_CONFIG[current.status].color}>
                          {STAGE_STATUS_CONFIG[current.status].label}
                        </Badge>
                        {timing.currentStageOpenHours != null && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" /> aberta há {formatDuration(timing.currentStageOpenHours)}
                          </span>
                        )}
                        {isMineNow && <span className="text-primary">é sua vez</span>}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {project.deadline && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Prazo {format(new Date(project.deadline), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    )}
                    <span>Tempo já gasto: {formatDuration(timing.totalSpentHours)}</span>
                  </div>

                  {done.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {done.map(s => (
                        <Badge key={s.id} variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Link to={`/projects/${project.id}`}>
                      <Button className="w-full">
                        <Play className="mr-2 h-4 w-4" /> Abrir fluxo <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full" onClick={() => finishProject(project)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar projeto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DeliveryPaymentDialog
          open={!!payTarget}
          onOpenChange={(o) => { if (!o) setPayTarget(null); }}
          projectName={payTarget?.name ?? ''}
          defaultAmount={Number((payTarget as any)?.payment_amount || 0)}
          onConfirm={confirmDeliveryPayment}
        />
      </div>
    </AppLayout>
  );
}
