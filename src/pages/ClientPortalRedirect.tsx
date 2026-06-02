import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function ClientPortalRedirect() {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('clients')
        .select('slug')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      setSlug(data?.slug ?? null);
    })();
  }, [user]);

  if (slug === undefined) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Abrindo seu painel...</div>
      </div>
    );
  }
  if (!slug) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Acesso não vinculado</h1>
          <p className="text-muted-foreground">Sua conta ainda não está vinculada a um cliente. Entre em contato com a equipe Racun.</p>
          <button
            className="text-primary underline"
            onClick={() => supabase.auth.signOut()}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }
  return <Navigate to={`/portal/${slug}`} replace />;
}
