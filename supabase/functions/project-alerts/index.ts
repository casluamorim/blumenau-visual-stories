import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const HOUR = 1000 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const { data: settings } = await admin
      .from('agency_settings')
      .select('deadline_alert_days, stalled_alert_hours')
      .limit(1)
      .maybeSingle();

    const deadlineDays = settings?.deadline_alert_days ?? 3;
    const stalledHours = settings?.stalled_alert_hours ?? 48;

    const [{ data: projects }, { data: stages }, { data: adminRoles }, { data: accessRows }] = await Promise.all([
      admin.from('projects').select('id, name, deadline, status').not('status', 'in', '(completed,cancelled)'),
      admin.from('project_stages').select('id, project_id, name, status, started_at, assigned_to'),
      admin.from('user_roles').select('user_id').eq('role', 'admin'),
      admin.from('project_access').select('project_id, user_id'),
    ]);

    const adminIds = (adminRoles ?? []).map((r) => r.user_id);
    const since = new Date(Date.now() - 20 * HOUR).toISOString();
    const { data: recent } = await admin
      .from('notifications')
      .select('user_id, project_id, stage_id, type')
      .gte('created_at', since);

    const seen = new Set(
      (recent ?? []).map((n) => `${n.user_id}|${n.project_id ?? ''}|${n.stage_id ?? ''}|${n.type}`),
    );

    const rows: any[] = [];
    const push = (userIds: string[], payload: { project_id: string; stage_id: string | null; type: string; title: string; message: string }) => {
      for (const uid of new Set(userIds.filter(Boolean))) {
        const key = `${uid}|${payload.project_id}|${payload.stage_id ?? ''}|${payload.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ user_id: uid, read: false, ...payload });
      }
    };

    const now = Date.now();

    for (const p of projects ?? []) {
      const members = [
        ...adminIds,
        ...(accessRows ?? []).filter((a) => a.project_id === p.id).map((a) => a.user_id),
      ];

      if (p.deadline) {
        const end = new Date(`${p.deadline}T23:59:59`).getTime();
        const daysLeft = Math.floor((end - now) / (24 * HOUR));
        if (end < now) {
          push(members, {
            project_id: p.id,
            stage_id: null,
            type: 'overdue',
            title: `Prazo estourado: ${p.name}`,
            message: `O prazo do projeto venceu em ${p.deadline} e ele ainda não foi concluído.`,
          });
        } else if (daysLeft <= deadlineDays) {
          push(members, {
            project_id: p.id,
            stage_id: null,
            type: 'deadline_near',
            title: `Prazo próximo: ${p.name}`,
            message: `Faltam ${daysLeft <= 0 ? 'menos de 1 dia' : `${daysLeft} dia(s)`} para o prazo (${p.deadline}).`,
          });
        }
      }

      for (const s of (stages ?? []).filter((x) => x.project_id === p.id && x.status === 'in_progress')) {
        if (!s.started_at) continue;
        const openHours = (now - new Date(s.started_at).getTime()) / HOUR;
        if (openHours < stalledHours) continue;
        push([...members, s.assigned_to].filter(Boolean) as string[], {
          project_id: p.id,
          stage_id: s.id,
          type: 'stalled',
          title: `Fase parada: ${s.name}`,
          message: `A fase "${s.name}" do projeto ${p.name} está aberta há ${Math.round(openHours)}h sem conclusão.`,
        });
      }
    }

    if (rows.length) {
      const { error } = await admin.from('notifications').insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, created: rows.length, deadlineDays, stalledHours }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
