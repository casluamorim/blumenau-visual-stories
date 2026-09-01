import { supabase } from '@/integrations/supabase/client';

export interface QuoteLike {
  id: string;
  client_id: string;
  title: string;
  total_value: number;
  notes?: string | null;
  services?: { name: string; value: number }[] | null;
}

export interface CreatedProject {
  id: string;
  name: string;
  client_id: string;
  quote_id: string;
  payment_amount: number;
}

/**
 * Proposta aprovada → cria projeto vinculado + tarefa em "Meu Trabalho" (fase).
 * O lançamento financeiro NUNCA é criado aqui: depende de confirmação em modal.
 */
export async function createProjectFromQuote(
  quote: QuoteLike,
  userId?: string,
): Promise<{ project: CreatedProject | null; error: Error | null; alreadyExists?: boolean }> {
  const { data: existing } = await supabase
    .from('projects')
    .select('id, name, client_id, quote_id, payment_amount')
    .eq('quote_id', quote.id)
    .maybeSingle();

  if (existing) {
    return { project: existing as any, error: null, alreadyExists: true };
  }

  const scope = (quote.services ?? [])
    .filter((s) => s?.name)
    .map((s) => `• ${s.name}`)
    .join('\n');
  const description = [scope, quote.notes].filter(Boolean).join('\n\n') || null;

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: quote.title,
      client_id: quote.client_id,
      status: 'in_progress' as any,
      priority: 'medium' as any,
      description,
      quote_id: quote.id,
      payment_amount: Number(quote.total_value || 0),
      payment_pending: true,
      created_by: userId ?? null,
    } as any)
    .select('id, name, client_id, quote_id, payment_amount')
    .single();

  if (error || !project) return { project: null, error: error as any };

  // Tarefa em "Meu Trabalho": fase inicial atribuída a quem aprovou
  await supabase.from('project_stages').insert({
    project_id: project.id,
    name: 'Execução do projeto',
    order_index: 0,
    status: 'in_progress' as any,
    assigned_to: userId ?? null,
    assigned_role: 'admin' as any,
  } as any);

  await supabase.from('project_updates').insert({
    project_id: project.id,
    user_id: userId ?? null,
    message: `Projeto criado automaticamente a partir da proposta aprovada "${quote.title}".`,
  } as any);

  return { project: project as any, error: null };
}

/** Cria o lançamento "a receber" no Financeiro PJ, vinculado a projeto + proposta. */
export async function createReceivableForProject(args: {
  clientId: string;
  projectId: string;
  quoteId?: string | null;
  title: string;
  amount: number;
  dueDate: string;
  userId?: string;
}) {
  return supabase.from('invoices').insert({
    client_id: args.clientId,
    project_id: args.projectId,
    quote_id: args.quoteId ?? null,
    title: `Recebimento - ${args.title}`,
    amount: args.amount,
    due_date: args.dueDate,
    status: 'pending' as any,
    financial_type: 'pj' as any,
    recurrence: 'one_time' as any,
    created_by: args.userId ?? null,
  } as any);
}

/** Marca projeto como concluído e fecha todas as fases abertas. */
export async function completeProject(projectId: string, userId?: string) {
  await supabase.from('projects').update({ status: 'completed' as any }).eq('id', projectId);
  await supabase
    .from('project_stages')
    .update({ status: 'completed' as any, completed_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .neq('status', 'completed');
  await supabase.from('project_updates').insert({
    project_id: projectId,
    user_id: userId ?? null,
    message: 'Projeto finalizado em Meu Trabalho.',
  } as any);
}
