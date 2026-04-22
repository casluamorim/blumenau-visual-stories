import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2, Key, MessageSquare, FileText, User as UserIcon,
  Upload, Save, Loader2, Copy, Eye, EyeOff, Users as UsersIcon,
} from 'lucide-react';
import { UsersManagement } from '@/components/settings/UsersManagement';

interface AgencySettings {
  id: string;
  agency_name: string;
  agency_logo_url: string | null;
  agency_phone: string | null;
  agency_email: string | null;
  agency_document: string | null;
  default_pix_key: string | null;
  default_pix_key_type: string | null;
  whatsapp_template: string;
  invoice_prefix: string;
  next_invoice_number: number;
  default_revision_limit: number;
  default_invoice_due_days: number;
  timezone: string;
  currency: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
}

const PIX_KEY_TYPES = [
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Aleatória' },
];

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPix, setShowPix] = useState(false);

  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { loadAll(); }, [user?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, p, r] = await Promise.all([
        supabase.from('agency_settings').select('*').limit(1).maybeSingle(),
        user ? supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        user ? supabase.from('user_roles').select('role').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
      ]);
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      setSettings(s.data as AgencySettings);
      setProfile(p.data as Profile);
      setIsAdmin((r.data || []).some((x: any) => x.role === 'admin'));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar configurações', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const { id, ...payload } = settings;
      const { error } = await supabase.from('agency_settings').update(payload).eq('id', id);
      if (error) throw error;
      toast({ title: 'Configurações salvas' });
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e.message.includes('row-level security')
          ? 'Apenas administradores podem alterar as configurações da agência.'
          : e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!profile || !user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Perfil atualizado' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar perfil', description: e.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadFile(file: File, prefix: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('agency-assets').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('agency-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, 'logos');
      setSettings({ ...settings, agency_logo_url: url });
      toast({ title: 'Logo enviada — clique em Salvar para confirmar' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadFile(file, `avatars/${profile.user_id}`);
      setProfile({ ...profile, avatar_url: url });
      toast({ title: 'Avatar enviado — clique em Salvar perfil' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  }

  function copyPix() {
    if (!settings?.default_pix_key) return;
    navigator.clipboard.writeText(settings.default_pix_key);
    toast({ title: 'Chave Pix copiada' });
  }

  if (loading || !settings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const update = <K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Configurações</h1>
            <p className="text-muted-foreground">Personalize o Racun OS para a sua agência</p>
          </div>
          {!isAdmin && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
              Modo somente leitura — apenas admins editam
            </Badge>
          )}
        </div>

        <Tabs defaultValue="agency">
          <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto">
            <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-6 gap-1">
              <TabsTrigger value="agency" className="whitespace-nowrap">
                <Building2 className="mr-2 h-4 w-4" />Agência
              </TabsTrigger>
              <TabsTrigger value="payments" className="whitespace-nowrap">
                <Key className="mr-2 h-4 w-4" />Pagamentos
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="whitespace-nowrap">
                <MessageSquare className="mr-2 h-4 w-4" />WhatsApp
              </TabsTrigger>
              <TabsTrigger value="defaults" className="whitespace-nowrap">
                <FileText className="mr-2 h-4 w-4" />Padrões
              </TabsTrigger>
              <TabsTrigger value="users" className="whitespace-nowrap">
                <UsersIcon className="mr-2 h-4 w-4" />Usuários
              </TabsTrigger>
              <TabsTrigger value="profile" className="whitespace-nowrap">
                <UserIcon className="mr-2 h-4 w-4" />Perfil
              </TabsTrigger>
            </TabsList>
          </div>

          {/* USUÁRIOS */}
          <TabsContent value="users" className="mt-6">
            <UsersManagement isAdmin={isAdmin} />
          </TabsContent>

          {/* AGÊNCIA */}
          <TabsContent value="agency" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados da agência</CardTitle>
                <CardDescription>Informações exibidas em faturas, portal do cliente e cobranças</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 rounded-lg">
                    <AvatarImage src={settings.agency_logo_url || undefined} className="object-contain" />
                    <AvatarFallback className="rounded-lg text-lg">
                      {settings.agency_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Enviar logo
                      </div>
                      <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={!isAdmin} />
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">PNG ou JPG — recomendado 512x512px</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Nome da agência</Label>
                    <Input value={settings.agency_name} onChange={e => update('agency_name', e.target.value)} disabled={!isAdmin} />
                  </div>
                  <div>
                    <Label>CNPJ / Documento</Label>
                    <Input value={settings.agency_document || ''} onChange={e => update('agency_document', e.target.value)} disabled={!isAdmin} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={settings.agency_email || ''} onChange={e => update('agency_email', e.target.value)} disabled={!isAdmin} placeholder="contato@agencia.com" />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={settings.agency_phone || ''} onChange={e => update('agency_phone', e.target.value)} disabled={!isAdmin} placeholder="+55 11 99999-9999" />
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={saving || !isAdmin}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGAMENTOS */}
          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Chave Pix padrão</CardTitle>
                <CardDescription>Usada automaticamente nas cobranças e mensagens de WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[200px_1fr_auto]">
                  <div>
                    <Label>Tipo da chave</Label>
                    <Select
                      value={settings.default_pix_key_type || 'cnpj'}
                      onValueChange={v => update('default_pix_key_type', v)}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PIX_KEY_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Chave Pix</Label>
                    <div className="relative">
                      <Input
                        type={showPix ? 'text' : 'password'}
                        value={settings.default_pix_key || ''}
                        onChange={e => update('default_pix_key', e.target.value)}
                        disabled={!isAdmin}
                        placeholder="Sua chave Pix"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPix(!showPix)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPix ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={copyPix} disabled={!settings.default_pix_key}>
                      <Copy className="mr-2 h-4 w-4" />Copiar
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1">
                  <p className="font-medium">💡 Como é usada</p>
                  <p className="text-muted-foreground">A chave Pix aparece automaticamente na variável <code className="rounded bg-muted px-1">{'{pix}'}</code> das mensagens de cobrança via WhatsApp.</p>
                </div>

                <Button onClick={saveSettings} disabled={saving || !isAdmin}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WHATSAPP */}
          <TabsContent value="whatsapp" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Modelo de mensagem WhatsApp</CardTitle>
                <CardDescription>Mensagem usada ao gerar cobrança automática</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Variáveis disponíveis</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['{empresa}', '{cliente}', '{valor}', '{vencimento}', '{pix}', '{titulo}'].map(v => (
                      <Badge key={v} variant="secondary" className="font-mono">{v}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Template</Label>
                  <Textarea
                    rows={10}
                    value={settings.whatsapp_template}
                    onChange={e => update('whatsapp_template', e.target.value)}
                    disabled={!isAdmin}
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={saveSettings} disabled={saving || !isAdmin}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PADRÕES */}
          <TabsContent value="defaults" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Padrões operacionais</CardTitle>
                <CardDescription>Valores aplicados automaticamente em novos registros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Prefixo de fatura</Label>
                    <Input value={settings.invoice_prefix} onChange={e => update('invoice_prefix', e.target.value)} disabled={!isAdmin} placeholder="FAT" />
                  </div>
                  <div>
                    <Label>Próximo número</Label>
                    <Input
                      type="number"
                      value={settings.next_invoice_number}
                      onChange={e => update('next_invoice_number', parseInt(e.target.value) || 1)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <Label>Limite padrão de revisões</Label>
                    <Input
                      type="number"
                      min={1}
                      value={settings.default_revision_limit}
                      onChange={e => update('default_revision_limit', parseInt(e.target.value) || 3)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <Label>Vencimento padrão (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={settings.default_invoice_due_days}
                      onChange={e => update('default_invoice_due_days', parseInt(e.target.value) || 7)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <Label>Fuso horário</Label>
                    <Input value={settings.timezone} onChange={e => update('timezone', e.target.value)} disabled={!isAdmin} />
                  </div>
                  <div>
                    <Label>Moeda</Label>
                    <Select value={settings.currency} onValueChange={v => update('currency', v)} disabled={!isAdmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={saving || !isAdmin}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFIL */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Meu perfil</CardTitle>
                <CardDescription>Suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{profile.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Label htmlFor="avatar-upload" className="cursor-pointer">
                          <div className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Trocar foto
                          </div>
                          <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        </Label>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Nome completo</Label>
                        <Input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                      </div>
                      <div>
                        <Label>E-mail</Label>
                        <Input value={profile.email || user?.email || ''} disabled />
                      </div>
                      <div>
                        <Label>Função no sistema</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge>{isAdmin ? 'Administrador' : profile.role || 'editor'}</Badge>
                        </div>
                      </div>
                    </div>

                    <Button onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Salvar perfil
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Perfil não encontrado.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
