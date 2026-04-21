import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'user.invited'
  | 'user.activated'
  | 'user.deactivated'
  | 'user.role_changed'
  | 'user.invite_accepted'
  | 'assignment.created'
  | 'assignment.removed'
  | 'assignment.level_changed';

export type AuditEntityType = 'user' | 'client_assignment';

interface LogParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Records an audit log entry. Failures are swallowed to avoid breaking UX —
 * the underlying business action should not be blocked by a logging issue.
 */
export async function logAudit({ action, entityType, entityId, details }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      user_id: user?.id ?? null,
      details: (details ?? {}) as never,
    } as never);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] failed to log', action, err);
  }
}
