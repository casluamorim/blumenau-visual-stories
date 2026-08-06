import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Update = Database['public']['Tables']['project_updates']['Row'];
type Stage = Database['public']['Tables']['project_stages']['Row'];

export function ProjectUpdatesFeed({
  updates,
  stages,
  names,
}: {
  updates: Update[];
  stages: Stage[];
  names: Record<string, string>;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">Histórico de atualizações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {updates.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
        )}
        {updates.map(u => {
          const stage = stages.find(s => s.id === u.stage_id);
          return (
            <div key={u.id} className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {(u.user_id && names[u.user_id]) || 'Equipe'}
                  </span>
                  {stage && <Badge variant="outline" className="text-[10px]">{stage.name}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(u.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{u.message}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
