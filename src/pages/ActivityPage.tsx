import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Clock } from 'lucide-react';

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setLogs(data ?? []));
  }, []);

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Atividades</h1>
          <p className="text-muted-foreground">Log completo de ações do sistema</p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Nenhuma atividade registrada.</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 p-4">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
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
