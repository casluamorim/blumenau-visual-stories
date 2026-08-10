import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Play, CheckCircle2, Circle, Clock, Plus, Trash2, ArrowRight, AlertTriangle, Timer, RotateCcw,
} from 'lucide-react';
import {
  calculateProjectTiming, formatDuration, STAGE_FLOW_PRESETS, STAGE_STATUS_CONFIG, STAGE_ROLE_LABELS,
} from '@/lib/projectTiming';
import { ProjectLinksPanel } from './ProjectLinksPanel';
import type { Database } from '@/integrations/supabase/types';

type Stage = Database['public']['Tables']['project_stages']['Row'];
type ProjectLink = Database['public']['Tables']['project_links']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

interface Props {
  projectId: string;
  project: {
    deadline: string | null;
    created_at?: string | null;
    is_monthly?: boolean | null;
    cycle_number?: number | null;
    cycle_label?: string | null;
  };
  stages: Stage[];
  links: ProjectLink[];
  canManage: boolean;
  canEditStage: (stage: Stage) => boolean;
  onChange: () => void;
}

export function StageTimeline({ projectId, project, stages, links, canManage, canEditStage, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newStageOpen, setNewStageOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowPreset, setFlowPreset] = useState('audiovisual');
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleLabel, setCycleLabel] = useState('');
  const [newStage, setNewStage] = useState({ name: '', assigned_role: 'editor' as AppRole, expected_duration_hours: '' });


  const timing = calculateProjectTiming(project, stages);
  const ordered = timing.stages;

  async function logUpdate(stageId: string | null, message: string) {
    if (!message.trim()) return;
    await supabase.from('project_updates').insert({
      project_id: projectId,
      stage_id: stageId,
      user_id: user?.id ?? null,
      message: message.trim(),
    });
  }

  async function generateFlow() {
    const preset = STAGE_FLOW_PRESETS.find(p => p.id === flowPreset) ?? STAGE_FLOW_PRESETS[0];
    setBusy('flow');
    const rows = preset.stages.map((s, i) => ({
      project_id: projectId,
      name: s.name,
      order_index: stages.length + i,
      assigned_role: s.assigned_role,
      expected_duration_hours: s.expected_duration_hours,
    }));
    const { error } = await supabase.from('project_stages').insert(rows);
    setBusy(null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Fluxo "${preset.label}" criado!` });
    setFlowOpen(false);
    onChange();
  }

  /** Fecha o ciclo atual (quem decide é a equipe, não a data) e reinicia as fases para o próximo mês. */
  async function closeCycle() {
    setBusy('cycle');
    const nextNumber = (project.cycle_number ?? 1) + 1;
    const label = cycleLabel.trim() || `Ciclo ${nextNumber}`;
    const done = stages.filter(s => s.status === 'completed').length;

    await logUpdate(
      null,
      `Ciclo "${project.cycle_label || `Ciclo ${project.cycle_number ?? 1}`}" encerrado pela equipe — ${done}/${stages.length} fases concluídas. Novo ciclo: ${label}.`,
    );

    const { error: upErr } = await supabase
      .from('project_stages')
      .update({ status: 'not_started', started_at: null, completed_at: null })
      .eq('project_id', projectId);

    const { error: projErr } = await supabase
      .from('projects')
      .update({ cycle_number: nextNumber, cycle_label: label, is_monthly: true, status: 'in_progress' })
      .eq('id', projectId);

    setBusy(null);
    const error = upErr || projErr;
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setCycleLabel('');
    setCycleOpen(false);
    toast({ title: `Novo ciclo iniciado: ${label}` });
    onChange();
  }


  async function addStage() {
    if (!newStage.name.trim()) { toast({ title: 'Informe o nome da fase', variant: 'destructive' }); return; }
    const { error } = await supabase.from('project_stages').insert({
      project_id: projectId,
      name: newStage.name.trim(),
      order_index: stages.length,
      assigned_role: newStage.assigned_role,
      expected_duration_hours: newStage.expected_duration_hours ? Number(newStage.expected_duration_hours) : null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Fase adicionada!' });
    setNewStage({ name: '', assigned_role: 'editor', expected_duration_hours: '' });
    setNewStageOpen(false);
    onChange();
  }

  async function removeStage(id: string) {
    const { error } = await supabase.from('project_stages').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    onChange();
  }

  async function startStage(stage: Stage) {
    setBusy(stage.id);
    const { error } = await supabase.from('project_stages')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', stage.id);
    if (!error) await logUpdate(stage.id, messages[stage.id] || `Fase "${stage.name}" iniciada.`);
    setBusy(null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setMessages(m => ({ ...m, [stage.id]: '' }));
    toast({ title: `Fase "${stage.name}" iniciada` });
    onChange();
  }

  async function completeStage(stage: Stage) {
    setBusy(stage.id);
    const { error } = await supabase.from('project_stages')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', stage.id);
    if (!error) await logUpdate(stage.id, messages[stage.id] || `Fase "${stage.name}" concluída.`);
    setBusy(null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setMessages(m => ({ ...m, [stage.id]: '' }));
    toast({ title: 'Fase concluída! Próxima fase liberada.' });
    onChange();
  }

  async function saveUpdate(stage: Stage) {
    const msg = messages[stage.id];
    if (!msg?.trim()) { toast({ title: 'Escreva o que foi feito', variant: 'destructive' }); return; }
    setBusy(stage.id);
    await logUpdate(stage.id, msg);
    setBusy(null);
    setMessages(m => ({ ...m, [stage.id]: '' }));
    toast({ title: 'Atualização registrada' });
    onChange();
  }

  return (
    <div className="space-y-4">
      {/* Resumo de tempo */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-lg text-foreground">Fluxo de trabalho</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={timing.levelClass}>{timing.levelLabel}</Badge>
            {canManage && stages.length === 0 && (
              <Button size="sm" onClick={generateDefaultFlow} disabled={busy === 'flow'}>
                <Plus className="mr-1 h-4 w-4" /> Gerar fluxo padrão
              </Button>
            )}
            {canManage && stages.length > 0 && (
              <Dialog open={newStageOpen} onOpenChange={setNewStageOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> Fase</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="text-foreground">Nova fase</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nome *</Label><Input value={newStage.name} onChange={e => setNewStage({ ...newStage, name: e.target.value })} className="bg-muted border-border" /></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Responsável (papel)</Label>
                        <Select value={newStage.assigned_role} onValueChange={(v: any) => setNewStage({ ...newStage, assigned_role: v })}>
                          <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="social_media">Social Media</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tempo estimado (horas)</Label>
                        <Input type="number" min={0} value={newStage.expected_duration_hours}
                          onChange={e => setNewStage({ ...newStage, expected_duration_hours: e.target.value })}
                          className="bg-muted border-border" />
                      </div>
                    </div>
                    <Button onClick={addStage} className="w-full">Adicionar fase</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stages.length > 0 && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{timing.completedStages} de {timing.totalStages} fases concluídas</span>
                  <span>{timing.progressPercent}%</span>
                </div>
                <Progress value={timing.progressPercent} className="h-2" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricBox label="Tempo gasto (concluído)" value={formatDuration(timing.totalSpentHours)} />
                <MetricBox label="Estimado total" value={formatDuration(timing.totalExpectedHours || null)} />
                <MetricBox label="Falta estimado" value={formatDuration(timing.remainingExpectedHours || null)} />
                <MetricBox
                  label="Até o prazo"
                  value={
                    timing.hoursUntilDeadline == null
                      ? 'Sem prazo'
                      : timing.hoursUntilDeadline < 0
                        ? `${formatDuration(Math.abs(timing.hoursUntilDeadline))} atrasado`
                        : formatDuration(timing.hoursUntilDeadline)
                  }
                  className={
                    timing.level === 'late' ? 'text-red-400' : timing.level === 'tight' ? 'text-amber-400' : 'text-emerald-400'
                  }
                />
              </div>
            </>
          )}
          {stages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma fase criada. {canManage ? 'Clique em "Gerar fluxo padrão" para começar.' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Linha do tempo */}
      <div className="space-y-3">
        {ordered.map((t, idx) => {
          const stage = t.stage;
          const cfg = STAGE_STATUS_CONFIG[stage.status];
          const editable = canEditStage(stage);
          const prev = ordered[idx - 1]?.stage;
          const blocked = stage.status === 'not_started' && prev && prev.status !== 'completed';
          const stageLinks = links.filter(l => l.stage_id === stage.id);
          const late = t.deltaHours != null && t.deltaHours > 0;

          return (
            <Card key={stage.id} className={`border-border bg-card ${stage.status === 'in_progress' ? 'border-primary/40' : ''}`}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5">
                      {stage.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : stage.status === 'in_progress' ? (
                        <Play className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        <span className="mr-2 text-xs text-muted-foreground">{idx + 1}.</span>{stage.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                        {stage.assigned_role && (
                          <Badge variant="outline" className="text-[10px]">
                            {STAGE_ROLE_LABELS[stage.assigned_role] ?? stage.assigned_role}
                          </Badge>
                        )}
                        {t.spentHours != null && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(t.spentHours)}
                            {t.expectedHours != null && ` / ${formatDuration(t.expectedHours)} previsto`}
                          </span>
                        )}
                        {late && (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> +{formatDuration(t.deltaHours!)} do previsto
                          </span>
                        )}
                        {t.onTime === true && stage.status === 'completed' && (
                          <span className="text-xs text-emerald-400">dentro do previsto</span>
                        )}
                        {stage.status === 'in_progress' && t.spentHours != null && t.spentHours > 48 && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <Timer className="h-3 w-3" /> parada há {formatDuration(t.spentHours)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStage(stage.id)} title="Excluir fase">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {editable && stage.status !== 'completed' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="O que foi feito nesta fase?"
                      value={messages[stage.id] ?? ''}
                      onChange={e => setMessages(m => ({ ...m, [stage.id]: e.target.value }))}
                      rows={2}
                      className="bg-muted border-border"
                    />
                    <div className="flex flex-wrap gap-2">
                      {stage.status === 'not_started' ? (
                        <Button size="sm" disabled={busy === stage.id || !!blocked} onClick={() => startStage(stage)}>
                          <Play className="mr-1 h-4 w-4" /> Iniciar fase
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy === stage.id} onClick={() => completeStage(stage)}>
                          <ArrowRight className="mr-1 h-4 w-4" /> Concluir e avançar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => saveUpdate(stage)}>
                        Registrar atualização
                      </Button>
                      {blocked && (
                        <span className="self-center text-xs text-muted-foreground">
                          Aguardando a fase anterior ser concluída
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <ProjectLinksPanel
                  compact
                  projectId={projectId}
                  links={stageLinks}
                  stages={stages}
                  canEdit={editable}
                  defaultStageId={stage.id}
                  onChange={onChange}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MetricBox({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold text-foreground ${className ?? ''}`}>{value}</p>
    </div>
  );
}
