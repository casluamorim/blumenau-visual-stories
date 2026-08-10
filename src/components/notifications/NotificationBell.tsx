import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Notification = Database['public']['Tables']['notifications']['Row'];

const typeIcon: Record<string, any> = {
  stage_completed: CheckCircle2,
  deadline_near: Clock,
  overdue: AlertTriangle,
  stalled: AlertTriangle,
};

const typeColor: Record<string, string> = {
  stage_completed: 'text-emerald-400',
  deadline_near: 'text-amber-400',
  overdue: 'text-red-400',
  stalled: 'text-amber-400',
};

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter(i => !i.read).length;

  async function markAllRead() {
    const ids = items.filter(i => !i.read).map(i => i.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    load();
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  }

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] border-border bg-card p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-3 w-3" /> Marcar lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[380px]">
          {items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
          )}
          {items.map(n => {
            const Icon = typeIcon[n.type] ?? Bell;
            const body = (
              <div className={`flex gap-3 border-b border-border p-3 ${n.read ? 'opacity-60' : ''}`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${typeColor[n.type] ?? 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {!n.read && <Badge variant="outline" className="h-fit text-[10px]">novo</Badge>}
              </div>
            );
            return n.project_id ? (
              <Link key={n.id} to={`/projects/${n.project_id}`} onClick={() => { markRead(n.id); setOpen(false); }}>
                {body}
              </Link>
            ) : (
              <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-left">{body}</button>
            );
          })}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Link to="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
              Ver histórico completo
            </Button>
          </Link>
        </div>

      </PopoverContent>
    </Popover>
  );
}
