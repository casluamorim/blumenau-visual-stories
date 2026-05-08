import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Mail, Phone, Building2, MoreHorizontal, Edit, Trash2, Link2, Copy, Check, ArrowRight, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { buildPortalUrl } from '@/lib/portal';

type Client = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];

const PAGE_SIZE = 24;

export default function Clients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState<ClientInsert>({
    name: '', company: '', email: '', phone: '', status: 'active', notes: '',
  });

  const { data, isFetching } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(`name.ilike.${s},company.ilike.${s},email.ilike.${s}`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Client[], count: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const clients = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function refresh() {
    qc.invalidateQueries({ queryKey: ['clients'] });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (editingClient) {
      const { error } = await supabase.from('clients').update(form).eq('id', editingClient.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Cliente atualizado!' });
    } else {
      const { error } = await supabase.from('clients').insert(form);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Cliente criado!' });
    }
    resetForm();
    refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cliente removido!' });
    refresh();
  }

  function resetForm() {
    setForm({ name: '', company: '', email: '', phone: '', status: 'active', notes: '' });
    setEditingClient(null);
    setDialogOpen(false);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({ name: client.name, company: client.company, email: client.email, phone: client.phone, status: client.status, notes: client.notes });
    setDialogOpen(true);
  }

  async function generatePortalLink(clientId: string) {
    // Ensure the client has an active token (required for RLS on portal data),
    // even when using slug-based URLs — the token stays invisible in the URL.
    const { data: existing } = await supabase
      .from('client_access_tokens')
      .select('token')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!existing?.token) {
      const { error } = await supabase
        .from('client_access_tokens')
        .insert({ client_id: clientId, created_by: user?.id });
      if (error) {
        toast({ title: 'Erro ao gerar link', description: error.message, variant: 'destructive' });
        return;
      }
    }

    // Fetch slug (auto-generated by DB trigger on insert/update).
    const { data: clientRow } = await supabase
      .from('clients')
      .select('slug')
      .eq('id', clientId)
      .maybeSingle();

    const identifier = clientRow?.slug;
    if (!identifier) {
      toast({ title: 'Erro ao gerar link', description: 'Slug do cliente não encontrado.', variant: 'destructive' });
      return;
    }

    const url = buildPortalUrl(identifier);
    await navigator.clipboard.writeText(url);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Link copiado!', description: url });
  }

  async function sharePortalOnWhatsApp(client: Client) {
    // Ensure token exists & fetch slug
    const { data: existing } = await supabase
      .from('client_access_tokens')
      .select('token').eq('client_id', client.id).eq('is_active', true).limit(1).maybeSingle();
    if (!existing?.token) {
      const { error } = await supabase
        .from('client_access_tokens')
        .insert({ client_id: client.id, created_by: user?.id });
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    }
    const { data: row } = await supabase.from('clients').select('slug').eq('id', client.id).maybeSingle();
    if (!row?.slug) { toast({ title: 'Slug não encontrado', variant: 'destructive' }); return; }

    const url = buildPortalUrl(row.slug);
    const message = `Olá ${client.name}! 👋\n\nSeu portal Racun está pronto. Acesse direto pelo link, sem precisar fazer login:\n\n${url}`;
    const phone = (client.phone ?? '').replace(/\D/g, '');
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    inactive: 'bg-red-500/10 text-red-400 border-red-500/20',
    prospect: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const statusLabels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', prospect: 'Prospect' };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="text-muted-foreground">{total} clientes cadastrados</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingClient ? 'Editar' : 'Novo'} Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-muted border-border" /></div>
                <div><Label>Empresa</Label><Input value={form.company ?? ''} onChange={e => setForm({ ...form, company: e.target.value })} className="bg-muted border-border" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input type="email" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-muted border-border" /></div>
                  <div><Label>Telefone</Label><Input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-muted border-border" /></div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status ?? 'active'} onValueChange={v => setForm({ ...form, status: v as any })}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-muted border-border" /></div>
                <Button onClick={handleSave} className="w-full">{editingClient ? 'Salvar' : 'Criar Cliente'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="bg-muted border-border pl-10"
          />
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => (
            <Card key={client.id} className="border-border bg-card group hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <Link to={`/clients/${client.id}`} className="min-w-0 flex-1">
                  <CardTitle className="text-lg text-foreground truncate hover:text-primary transition-colors">{client.name}</CardTitle>
                  {client.company && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Building2 className="h-3 w-3" /> {client.company}
                    </p>
                  )}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/clients/${client.id}`}><ArrowRight className="mr-2 h-4 w-4" /> Abrir cliente</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generatePortalLink(client.id)}>
                      {copiedId === client.id ? <Check className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
                      {copiedId === client.id ? 'Link copiado!' : 'Link do Portal'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(client)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(client.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3 w-3" />{client.email}</p>}
                {client.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{client.phone}</p>}
                <Badge className={statusColors[client.status] ?? ''} variant="outline">{statusLabels[client.status] ?? client.status}</Badge>
              </CardContent>
            </Card>
          ))}
          {clients.length === 0 && !isFetching && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado. Crie o primeiro!'}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} clientes
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isFetching}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages || isFetching}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
