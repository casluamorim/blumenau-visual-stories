import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { logAudit } from '@/lib/auditLog';

interface InviteProfile {
  id: string;
  full_name: string;
  email: string;
  token: string;
  expires_at: string;
  role: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const db = supabase as any;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteProfile | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [token]);

  async function load() {
    if (!token) { setError('Token inválido'); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await db.rpc('get_user_invite_by_token', { _token: token });

      if (error) throw error;
      const inviteData = Array.isArray(data) ? data[0] : data;
      if (!inviteData) { setError('Convite não encontrado ou já utilizado.'); return; }
      if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
        setError('Este convite expirou. Solicite um novo ao administrador.');
        return;
      }
      setInvite(inviteData as InviteProfile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!invite) return;
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Senhas diferentes', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Sign up the user
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: invite.full_name },
        },
      });
      if (signErr) throw signErr;

      const newUserId = signUp.user?.id;
      if (!newUserId) throw new Error('Não foi possível criar o usuário.');

      const role = (params.get('role') || invite.role || 'editor');

      await logAudit({
        action: 'user.invite_accepted',
        entityType: 'user',
        entityId: newUserId,
        details: { full_name: invite.full_name, email: invite.email, role },
      });

      toast({ title: 'Bem-vindo ao Racun OS!', description: 'Conta criada com sucesso.' });
      navigate('/');
    } catch (e: any) {
      toast({ title: 'Erro ao aceitar convite', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display">Aceitar convite</CardTitle>
          <CardDescription>
            {loading ? 'Carregando…' : error ? 'Não foi possível continuar' : `Olá, ${invite?.full_name}! Defina sua senha para acessar o Racun OS.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
            </div>
          ) : (
            <>
              <div>
                <Label>E-mail</Label>
                <Input value={invite?.email || ''} disabled />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <Button className="w-full" onClick={accept} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta e entrar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
