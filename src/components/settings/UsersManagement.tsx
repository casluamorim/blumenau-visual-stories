import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2, UserPlus, Copy, Power, Link2, Users, Trash2, Shield, FlaskConical,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { logAudit } from '@/lib/auditLog';

type AppRole = 'admin' | 'manager' | 'editor' | 'viewer' | 'financeiro' | 'social_media';

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Acesso total ao sistema' },
  { value: 'manager', label: 'Gestor', description: 'Gerencia clientes vinculados e tarefas' },
  { value: 'financeiro', label: 'Financeiro', description: 'Acesso total ao financeiro' },
  { value: 'social_media', label: 'Social Media', description: 'Apenas clientes vinculados' },
  { value: 'editor', label: 'Editor', description: 'Edita projetos e conteúdos vinculados' },
  { value: 'viewer', label: 'Visualizador', description: 'Apenas leitura' },
];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  financeiro: 'Financeiro',
  social_media: 'Social Media',
  editor: 'Editor',
  viewer: 'Visualizador',
};

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  invite_token: string | null;
  invite_expires_at: string | null;
  invited_at: string | null;
  roles: AppRole[];
  client_count: number;
  invite_id?: string;
  is_invite?: boolean;
}

interface Client {
  id: string;
  name: string;
  company: string | null;
}

interface Assignment {
  id: string;
  client_id: string;
  user_id: string;
  access_level: 'view' | 'edit' | 'admin';
  is_primary: boolean;
}

export function UsersManagement({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const db = supabase as any;
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // create dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('editor');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // assignments dialog
  const [openAssign, setOpenAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState<UserRow | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // RLS QA tests
  const [openQa, setOpenQa] = useState(false);
  const [runningQa, setRunningQa] = useState(false);
  const [qaResults, setQaResults] = useState<{
    ok: boolean;
    error: string | null;
    summary: { total: number; passed: number; failed: number };
    results: { name: string; passed: boolean; detail?: string }[];
  } | null>(null);

  async function runRlsQaTests() {
    setRunningQa(true);
    setQaResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('qa-rls-tests', { body: {} });
      if (error) throw error;
      setQaResults(data);
      if (data?.ok) {
        toast({ title: 'Testes de RLS passaram', description: `${data.summary.passed}/${data.summary.total}` });
      } else {
        toast({
          title: 'Testes de RLS falharam',
          description: data?.error || `${data?.summary?.failed ?? '?'} falha(s)`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao rodar testes', description: e.message, variant: 'destructive' });
    } finally {
      setRunningQa(false);
    }
  }

  useEffect(() => { if (isAdmin) loadAll(); else setLoading(false); }, [isAdmin]);

  function buildInviteLink(token: string, role: AppRole, email: string) {
    return `${window.location.origin}/accept-invite/${token}?role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, clientsRes, assignCountRes, invitesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('clients').select('id, name, company').order('name'),
        supabase.from('client_assignments').select('user_id'),
        db.from('user_invites').select('id, full_name, email, role, token, expires_at, created_at').is('accepted_at', null).order('created_at', { ascending: false }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (invitesRes.error) throw invitesRes.error;

      const rolesByUser: Record<string, AppRole[]> = {};
      (rolesRes.data || []).forEach((r: any) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] || []), r.role];
      });
      const countByUser: Record<string, number> = {};
      (assignCountRes.data || []).forEach((a: any) => {
        countByUser[a.user_id] = (countByUser[a.user_id] || 0) + 1;
      });

      const rows: UserRow[] = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name || '(sem nome)',
        email: p.email,
        is_active: p.is_active ?? true,
        invite_token: p.invite_token,
        invite_expires_at: p.invite_expires_at,
        invited_at: p.invited_at,
        roles: rolesByUser[p.user_id] || [],
        client_count: countByUser[p.user_id] || 0,
      }));

      const inviteRows: UserRow[] = (invitesRes.data || []).map((invite: any) => ({
        id: `invite-${invite.id}`,
        invite_id: invite.id,
        user_id: `invite-${invite.id}`,
        full_name: invite.full_name,
        email: invite.email,
        is_active: false,
        invite_token: invite.token,
        invite_expires_at: invite.expires_at,
        invited_at: invite.created_at,
        roles: [invite.role],
        client_count: 0,
        is_invite: true,
      }));

      setUsers([...inviteRows, ...rows]);
      setClients((clientsRes.data || []) as Client[]);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar usuários', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function genToken() {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function createInvite() {
    if (!newName.trim() || !newEmail.trim()) {
      toast({ title: 'Preencha nome e e-mail', variant: 'destructive' });
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const hasExistingUser = users.some(
      (u) => !u.is_invite && (u.email || '').toLowerCase() === normalizedEmail,
    );

    if (hasExistingUser) {
      toast({ title: 'E-mail já cadastrado', description: 'Já existe um usuário com este e-mail.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const token = genToken();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.from('user_invites').delete().eq('email', normalizedEmail).is('accepted_at', null);

      const { data: inviteData, error: pErr } = await db.from('user_invites').insert({
        full_name: newName.trim(),
        email: normalizedEmail,
        role: newRole,
        token,
        expires_at: expires,
        invited_by: user?.id,
      }).select('id').single();
      if (pErr) throw pErr;

      const link = buildInviteLink(token, newRole, normalizedEmail);
      setGeneratedLink(link);
      await logAudit({
        action: 'user.invited',
        entityType: 'user',
        entityId: inviteData?.id ?? null,
        details: { full_name: newName.trim(), email: normalizedEmail, role: newRole },
      });
      toast({ title: 'Convite criado', description: 'Copie o link e envie ao novo usuário' });
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro ao criar convite', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  function resetCreate() {
    setNewName(''); setNewEmail(''); setNewRole('editor'); setGeneratedLink(null);
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado' });
  }

  async function toggleActive(u: UserRow) {
    if (u.is_invite) return;
    try {
      const newStatus = !u.is_active;
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('user_id', u.user_id);
      if (error) throw error;
      await logAudit({
        action: newStatus ? 'user.activated' : 'user.deactivated',
        entityType: 'user',
        entityId: u.user_id,
        details: { full_name: u.full_name, email: u.email },
      });
      toast({ title: u.is_active ? 'Usuário desativado' : 'Usuário ativado' });
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  async function changeRole(u: UserRow, role: AppRole) {
    try {
      const previousRole = (u.roles[0] || (u as any).role || 'editor') as AppRole;
      if (u.is_invite && u.invite_id) {
        const { error } = await db.from('user_invites').update({ role }).eq('id', u.invite_id);
        if (error) throw error;
        await logAudit({
          action: 'user.role_changed',
          entityType: 'user',
          entityId: u.invite_id,
          details: { full_name: u.full_name, from: previousRole, to: role, email: u.email, pending_invite: true },
        });
        toast({ title: 'Função do convite atualizada' });
        await loadAll();
        return;
      }

      // remove existing roles, add new one (single role per user for simplicity)
      const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', u.user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('user_roles').insert({ user_id: u.user_id, role });
      if (insErr) throw insErr;
      // also mirror on profile.role text for display
      await supabase.from('profiles').update({ role }).eq('user_id', u.user_id);
      await logAudit({
        action: 'user.role_changed',
        entityType: 'user',
        entityId: u.user_id,
        details: { full_name: u.full_name, from: previousRole, to: role },
      });
      toast({ title: 'Função atualizada' });
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar função', description: e.message, variant: 'destructive' });
    }
  }

  async function openAssignments(u: UserRow) {
    if (u.is_invite) {
      toast({ title: 'Convite pendente', description: 'Vincule clientes depois que o usuário concluir o cadastro.', variant: 'destructive' });
      return;
    }
    setAssignTarget(u);
    setOpenAssign(true);
    setLoadingAssign(true);
    try {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('*')
        .eq('user_id', u.user_id);
      if (error) throw error;
      setAssignments((data || []) as Assignment[]);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar vínculos', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAssign(false);
    }
  }

  async function addAssignment(clientId: string) {
    if (!assignTarget) return;
    try {
      const { data, error } = await supabase.from('client_assignments').insert({
        client_id: clientId,
        user_id: assignTarget.user_id,
        access_level: 'edit',
        assigned_by: user?.id,
      }).select('id').single();
      if (error) throw error;
      const client = clients.find(c => c.id === clientId);
      await logAudit({
        action: 'assignment.created',
        entityType: 'client_assignment',
        entityId: data?.id ?? null,
        details: {
          user_id: assignTarget.user_id,
          user_name: assignTarget.full_name,
          client_id: clientId,
          client_name: client?.company || client?.name,
          access_level: 'edit',
        },
      });
      await openAssignments(assignTarget);
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  async function removeAssignment(id: string) {
    try {
      const removed = assignments.find(a => a.id === id);
      const client = removed ? clients.find(c => c.id === removed.client_id) : null;
      const { error } = await supabase.from('client_assignments').delete().eq('id', id);
      if (error) throw error;
      await logAudit({
        action: 'assignment.removed',
        entityType: 'client_assignment',
        entityId: id,
        details: {
          user_id: removed?.user_id,
          user_name: assignTarget?.full_name,
          client_id: removed?.client_id,
          client_name: client?.company || client?.name,
        },
      });
      if (assignTarget) await openAssignments(assignTarget);
      await loadAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  async function changeAssignmentLevel(id: string, level: 'view' | 'edit' | 'admin') {
    try {
      const previous = assignments.find(a => a.id === id);
      const client = previous ? clients.find(c => c.id === previous.client_id) : null;
      const { error } = await supabase.from('client_assignments').update({ access_level: level }).eq('id', id);
      if (error) throw error;
      await logAudit({
        action: 'assignment.level_changed',
        entityType: 'client_assignment',
        entityId: id,
        details: {
          user_id: previous?.user_id,
          user_name: assignTarget?.full_name,
          client_id: previous?.client_id,
          client_name: client?.company || client?.name,
          from: previous?.access_level,
          to: level,
        },
      });
      if (assignTarget) await openAssignments(assignTarget);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Acesso restrito</CardTitle>
          <CardDescription>Apenas administradores podem gerenciar usuários da agência.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableClients = clients.filter(
    c => !assignments.some(a => a.client_id === c.id)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Usuários da agência</CardTitle>
            <CardDescription>Gerencie membros, funções e acesso a clientes</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpenQa(true)} disabled={runningQa}>
              {runningQa ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              Testar RLS
            </Button>
            <Dialog open={openCreate} onOpenChange={(o) => { setOpenCreate(o); if (!o) resetCreate(); }}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-2 h-4 w-4" />Novo usuário</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar novo usuário</DialogTitle>
                <DialogDescription>
                  Será gerado um link de convite válido por 7 dias. Envie-o ao novo membro para que ele crie a senha.
                </DialogDescription>
              </DialogHeader>
              {!generatedLink ? (
                <div className="space-y-4">
                  <div>
                    <Label>Nome completo</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="João Silva" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="joao@agencia.com" />
                  </div>
                  <div>
                    <Label>Função</Label>
                    <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            <div className="flex flex-col">
                              <span>{r.label}</span>
                              <span className="text-xs text-muted-foreground">{r.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Link de convite (envie para o usuário):</p>
                  <div className="flex gap-2">
                    <Input value={generatedLink} readOnly className="font-mono text-xs" />
                    <Button variant="outline" onClick={() => copyLink(generatedLink)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Válido por 7 dias.</p>
                </div>
              )}
              <DialogFooter>
                {!generatedLink ? (
                  <Button onClick={createInvite} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gerar convite
                  </Button>
                ) : (
                  <Button onClick={() => { setOpenCreate(false); resetCreate(); }}>Concluir</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum usuário ainda.
                  </TableCell>
                </TableRow>
              ) : users.map(u => {
                const currentRole = (u.roles[0] || (u as any).role || 'editor') as AppRole;
                const isPending = u.is_invite || (!!u.invite_token && !u.is_active);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                    <TableCell>
                      <Select value={currentRole} onValueChange={v => changeRole(u, v as AppRole)}>
                        <SelectTrigger className="w-[160px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isPending ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/50">Convite pendente</Badge>
                      ) : u.is_active ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.client_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {isPending && u.invite_token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(buildInviteLink(u.invite_token, currentRole, u.email || ''))}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openAssignments(u)} disabled={isPending}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                      {!isPending && <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Power className={`h-4 w-4 ${u.is_active ? 'text-foreground' : 'text-muted-foreground'}`} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{u.is_active ? 'Desativar' : 'Ativar'} usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {u.is_active
                                ? 'O usuário perderá acesso ao sistema, mas seus dados serão preservados.'
                                : 'O usuário voltará a ter acesso conforme suas permissões.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => toggleActive(u)}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assignments dialog */}
      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vínculos de cliente — {assignTarget?.full_name}</DialogTitle>
            <DialogDescription>
              Defina quais clientes este usuário pode acessar e o nível de permissão.
            </DialogDescription>
          </DialogHeader>

          {loadingAssign ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Adicionar cliente</Label>
                <Select onValueChange={addAssignment} value="">
                  <SelectTrigger><SelectValue placeholder={availableClients.length ? 'Selecione um cliente…' : 'Todos os clientes já vinculados'} /></SelectTrigger>
                  <SelectContent>
                    {availableClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company || c.name}{c.company && c.name ? ` — ${c.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Acesso</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          Nenhum cliente vinculado.
                        </TableCell>
                      </TableRow>
                    ) : assignments.map(a => {
                      const c = clients.find(x => x.id === a.client_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{c ? (c.company || c.name) : a.client_id}</TableCell>
                          <TableCell>
                            <Select
                              value={a.access_level}
                              onValueChange={v => changeAssignmentLevel(a.id, v as any)}
                            >
                              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="view">Visualização</SelectItem>
                                <SelectItem value="edit">Edição</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
