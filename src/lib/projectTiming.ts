// Cálculo de tempo gasto por fase e comparação com o prazo do projeto.
import type { Database } from '@/integrations/supabase/types';

export type ProjectStage = Database['public']['Tables']['project_stages']['Row'];
type ProjectLike = { deadline?: string | null; created_at?: string | null };

export interface StageTiming {
  stage: ProjectStage;
  /** horas gastas (fase concluída = completed-started; em andamento = agora-started) */
  spentHours: number | null;
  expectedHours: number | null;
  /** diferença em horas em relação ao previsto (positivo = passou) */
  deltaHours: number | null;
  onTime: boolean | null;
  running: boolean;
}

export type TimingLevel = 'ok' | 'tight' | 'late';

export interface ProjectTiming {
  stages: StageTiming[];
  /** soma das horas das fases concluídas */
  totalSpentHours: number;
  /** soma das horas estimadas de todas as fases */
  totalExpectedHours: number;
  /** horas estimadas das fases que ainda faltam */
  remainingExpectedHours: number;
  /** horas até o deadline (negativo = já estourou) */
  hoursUntilDeadline: number | null;
  daysUntilDeadline: number | null;
  completedStages: number;
  totalStages: number;
  progressPercent: number;
  currentStage: ProjectStage | null;
  /** horas que a fase atual está aberta sem conclusão */
  currentStageOpenHours: number | null;
  level: TimingLevel;
  levelLabel: string;
  levelClass: string;
  isOverdue: boolean;
}

const MS_HOUR = 1000 * 60 * 60;

function hoursBetween(from: string | null, to: string | null | Date): number | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to as string).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, (end - start) / MS_HOUR);
}

export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 48) return `${hours.toFixed(1).replace('.0', '')}h`;
  const days = hours / 24;
  return `${days.toFixed(1).replace('.0', '')}d`;
}

export function calculateProjectTiming(project: ProjectLike, stages: ProjectStage[]): ProjectTiming {
  const ordered = [...stages].sort((a, b) => a.order_index - b.order_index);

  const stageTimings: StageTiming[] = ordered.map((stage) => {
    const running = stage.status === 'in_progress';
    const spentHours =
      stage.status === 'completed'
        ? hoursBetween(stage.started_at, stage.completed_at)
        : running
          ? hoursBetween(stage.started_at, null)
          : null;
    const expectedHours = stage.expected_duration_hours != null ? Number(stage.expected_duration_hours) : null;
    const deltaHours = spentHours != null && expectedHours != null ? spentHours - expectedHours : null;
    return {
      stage,
      spentHours,
      expectedHours,
      deltaHours,
      onTime: deltaHours == null ? null : deltaHours <= 0,
      running,
    };
  });

  const totalSpentHours = stageTimings
    .filter((s) => s.stage.status === 'completed')
    .reduce((acc, s) => acc + (s.spentHours ?? 0), 0);

  const totalExpectedHours = stageTimings.reduce((acc, s) => acc + (s.expectedHours ?? 0), 0);
  const remainingExpectedHours = stageTimings
    .filter((s) => s.stage.status !== 'completed')
    .reduce((acc, s) => acc + (s.expectedHours ?? 0), 0);

  const completedStages = ordered.filter((s) => s.status === 'completed').length;
  const totalStages = ordered.length;
  const progressPercent = totalStages ? Math.round((completedStages / totalStages) * 100) : 0;

  const currentStage =
    ordered.find((s) => s.status === 'in_progress') ??
    ordered.find((s) => s.status === 'not_started') ??
    null;
  const currentStageOpenHours =
    currentStage && currentStage.status === 'in_progress' ? hoursBetween(currentStage.started_at, null) : null;

  let hoursUntilDeadline: number | null = null;
  if (project.deadline) {
    const end = new Date(`${project.deadline}T23:59:59`).getTime();
    if (!Number.isNaN(end)) hoursUntilDeadline = (end - Date.now()) / MS_HOUR;
  }
  const daysUntilDeadline = hoursUntilDeadline != null ? Math.floor(hoursUntilDeadline / 24) : null;
  const isOverdue = hoursUntilDeadline != null && hoursUntilDeadline < 0 && completedStages < totalStages;

  // ritmo: se o previsto que falta não cabe no tempo restante, sinaliza risco
  let level: TimingLevel = 'ok';
  if (hoursUntilDeadline != null && completedStages < totalStages) {
    if (hoursUntilDeadline < 0) level = 'late';
    else if (remainingExpectedHours > 0 && remainingExpectedHours > hoursUntilDeadline) level = 'late';
    else if (hoursUntilDeadline <= 72) level = 'tight';
  }

  const levelLabel =
    level === 'late'
      ? isOverdue
        ? 'Prazo estourado'
        : 'Risco de atraso'
      : level === 'tight'
        ? 'Prazo apertado'
        : 'No prazo';

  const levelClass =
    level === 'late'
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : level === 'tight'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  return {
    stages: stageTimings,
    totalSpentHours,
    totalExpectedHours,
    remainingExpectedHours,
    hoursUntilDeadline,
    daysUntilDeadline,
    completedStages,
    totalStages,
    progressPercent,
    currentStage,
    currentStageOpenHours,
    level,
    levelLabel,
    levelClass,
    isOverdue,
  };
}

export const DEFAULT_STAGE_FLOW: { name: string; assigned_role: Database['public']['Enums']['app_role'] | null; expected_duration_hours: number | null }[] = [
  { name: 'Captação', assigned_role: 'social_media', expected_duration_hours: 8 },
  { name: 'Decupagem', assigned_role: 'editor', expected_duration_hours: 4 },
  { name: 'Edição Bruta', assigned_role: 'editor', expected_duration_hours: 12 },
  { name: 'Revisão Interna', assigned_role: 'admin', expected_duration_hours: 4 },
  { name: 'Ajustes', assigned_role: 'editor', expected_duration_hours: 6 },
  { name: 'Aprovação Cliente', assigned_role: 'admin', expected_duration_hours: 24 },
  { name: 'Entrega Final', assigned_role: 'admin', expected_duration_hours: 2 },
];

export const STAGE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Não iniciada', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

export const STAGE_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  editor: 'Editor',
  social_media: 'Social Media',
  viewer: 'Visualizador',
  financeiro: 'Financeiro',
  client: 'Cliente',
};
