import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: 'Link enviado',
          description: 'Verifique seu e-mail para redefinir a senha.',
        });
        setMode('login');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl font-bold text-foreground">
            Racun<span className="text-primary">.</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === 'login' ? 'Entre na sua conta' : 'Recuperar acesso'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-muted border-border"
            />
            {mode === 'login' && (
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-muted border-border"
              />
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Carregando...'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Enviar link de recuperação'}
            </Button>
          </form>
          <button
            onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === 'login' ? 'Esqueci minha senha' : 'Voltar para login'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
