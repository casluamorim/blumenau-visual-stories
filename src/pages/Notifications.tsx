import { AppLayout } from '@/components/layout/AppLayout';
import { NotificationsHistory } from '@/components/notifications/NotificationsHistory';

export default function NotificationsPage() {
  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="page-title">Notificações</h1>
          <p className="text-muted-foreground">Histórico completo por projeto e por fase</p>
        </div>
        <NotificationsHistory />
      </div>
    </AppLayout>
  );
}
