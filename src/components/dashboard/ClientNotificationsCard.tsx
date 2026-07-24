import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle2, MessageSquare, AlertCircle, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  client_id: string | null;
  content_id: string | null;
  kind: string;
  title: string;
  message: string | null;
  author_name: string | null;
  read_at: string | null;
  created_at: string;
}

const kindMeta: Record<string, { icon: any; tone: string }> = {
  approved: { icon: CheckCircle2, tone: 'text-emerald-500' },
  change_requested: { icon: AlertCircle, tone: 'text-amber-500' },
  comment: { icon: MessageSquare, tone: 'text-blue-500' },
};

export function ClientNotificationsCard() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('client_notifications_dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_notifications' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function markRead(id: string) {
    await supabase.from('client_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAllRead() {
    const unread = items.filter(n => !n.read_at).map(n => n.id);
    if (unread.length === 0) return;
    await supabase.from('client_notifications').update({ read_at: new Date().toISOString() }).in('id', unread);
    load();
  }

  const unreadCount = items.filter(n => !n.read_at).length;
  const visible = showAll ? items : items.slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Atividade dos clientes
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
            Marcar todas como lidas
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma atividade recente dos clientes.
          </p>
        ) : (
          <>
            {visible.map(n => {
              const meta = kindMeta[n.kind] ?? { icon: Bell, tone: 'text-muted-foreground' };
              const Icon = meta.icon;
              const unread = !n.read_at;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    unread ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.tone}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">"{n.message}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {n.author_name && (
                        <span className="text-[11px] text-muted-foreground">— {n.author_name}</span>
                      )}
                      {n.content_id && (
                        <Link
                          to={`/contents`}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Ver conteúdo →
                        </Link>
                      )}
                      {unread && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" /> marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {items.length > 6 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll(s => !s)}>
                {showAll ? 'Mostrar menos' : `Ver todas (${items.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
