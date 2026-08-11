import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STAGE_FLOW_PRESETS, type StageFlowItem } from '@/lib/projectTiming';

export interface FlowPreset {
  id: string;
  key: string;
  label: string;
  description: string | null;
  stages: StageFlowItem[];
  is_active: boolean;
  order_index: number;
}

/** Fallback usado enquanto os presets do banco não carregam. */
const FALLBACK: FlowPreset[] = STAGE_FLOW_PRESETS.map((p, i) => ({
  id: p.id,
  key: p.id,
  label: p.label,
  description: p.description,
  stages: p.stages,
  is_active: true,
  order_index: i,
}));

export function useStageFlowPresets(onlyActive = true) {
  const [presets, setPresets] = useState<FlowPreset[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stage_flow_presets' as any)
      .select('*')
      .order('order_index');
    const rows = ((data ?? []) as any[]).map(r => ({
      ...r,
      stages: Array.isArray(r.stages) ? r.stages : [],
    })) as FlowPreset[];
    if (rows.length) setPresets(onlyActive ? rows.filter(r => r.is_active) : rows);
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => { load(); }, [load]);

  return { presets, loading, reload: load };
}

/** Cria as fases de um projeto a partir de um preset de fluxo. */
export async function applyFlowPreset(projectId: string, preset: FlowPreset, offset = 0) {
  if (!preset.stages?.length) return null;
  const rows = preset.stages.map((s, i) => ({
    project_id: projectId,
    name: s.name,
    order_index: offset + i,
    assigned_role: s.assigned_role ?? null,
    expected_duration_hours: s.expected_duration_hours ?? null,
  }));
  const { error } = await supabase.from('project_stages').insert(rows as any);
  return error;
}
