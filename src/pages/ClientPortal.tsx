import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, CheckCircle, XCircle, Clock, MessageSquare,
  FolderKanban, Send, AlertTriangle, Building2, DollarSign, Video, ExternalLink
} from 'lucide-react';
import { getDrivePreviewUrl } from '@/lib/drive';

const contentStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: Clock },
  in_review: { label: 'Aguardando Aprovação', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
  revision: { label: 'Em Correção', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: AlertTriangle },
  approved: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  published: { label: 'Publicado', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: CheckCircle },
};

const typeLabels: Record<string, string> = {
  photo: 'Foto', video: 'Vídeo', reels: 'Reels', stories: 'Stories',
  carousel: 'Carrossel', cover: 'Capa', banner: 'Banner', other: 'Outro',
};

interface ClientData {
  id: string;
  name: string;
  company: string | null;
}

interface ProjectData {
  id: string;
  name: string;
  status: string;
  contents: ContentData[];
}

interface ContentFile {
  name: string;
  url: string;
}

interface ContentComment {
  id: string;
  target: string;
  author_name: string | null;
  text: string;
  created_at: string;
}

interface ContentData {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  revision_count: number | null;
  revision_limit: number | null;
  description: string | null;
  caption: string | null;
  media_status: string;
  copy_status: string;
  project_id: string;
  checklist: any;
  drive_url: string | null;
  files?: ContentFile[];
  comments?: ContentComment[];
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<ClientData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (token) loadPortalData();
  }, [token]);

  async function loadPortalData() {
    setLoading(true);

    // Validate token and get client
    const { data: tokenData, error: tokenError } = await supabase
      .from('client_access_tokens')
      .select('client_id')
      .eq('token', token!)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      setError('Link inválido ou expirado.');
      setLoading(false);
      return;
    }

    const clientId = tokenData.client_id;

    // Load client info
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, company')
      .eq('id', clientId)
      .single();

    if (!clientData) {
      setError('Cliente não encontrado.');
      setLoading(false);
      return;
    }

    setClient(clientData);

    // Load projects with contents
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    const projectsWithContents: ProjectData[] = [];

    for (const project of projectsData ?? []) {
      const { data: contents } = await supabase
        .from('contents')
        .select('id, title, type, status, priority, revision_count, revision_limit, description, caption, media_status, copy_status, project_id, checklist, drive_url')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      const contentsWithFiles: ContentData[] = [];
      for (const c of contents ?? []) {
        const [{ data: files }, { data: cmts }] = await Promise.all([
          supabase.storage.from('content-files').list(`${project.id}/${c.id}`),
          supabase.from('content_comments').select('*').eq('content_id', c.id).order('created_at', { ascending: true }),
        ]);
        const mapped: ContentFile[] = (files ?? []).map(f => ({
          name: f.name,
          url: supabase.storage.from('content-files')
            .getPublicUrl(`${project.id}/${c.id}/${f.name}`).data.publicUrl,
        }));
        contentsWithFiles.push({ ...(c as any), files: mapped, comments: (cmts as any) ?? [] });
      }

      projectsWithContents.push({
        ...project,
        contents: contentsWithFiles,
      });
    }

    setProjects(projectsWithContents);

    // Load invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: false });

    setInvoicesData(invoices ?? []);
    setLoading(false);
  }

  async function approvePart(contentId: string, part: 'media' | 'copy') {
    const patch: any = part === 'media' ? { media_status: 'approved' } : { copy_status: 'approved' };
    const { error } = await supabase.from('contents').update(patch).eq('id', contentId);
    if (error) { toast({ title: 'Erro ao aprovar', variant: 'destructive' }); return; }
    // If both approved, mark global status as approved
    const c = projects.flatMap(p => p.contents).find(c => c.id === contentId);
    const newMedia = part === 'media' ? 'approved' : c?.media_status;
    const newCopy = part === 'copy' ? 'approved' : c?.copy_status;
    const hasCopy = !!(c?.caption && c.caption.trim());
    if (newMedia === 'approved' && (!hasCopy || newCopy === 'approved')) {
      await supabase.from('contents').update({ status: 'approved' as any }).eq('id', contentId);
    }
    toast({ title: part === 'media' ? '✅ Mídia aprovada!' : '✅ Copy aprovada!' });
    loadPortalData();
  }

  async function requestChange(contentId: string, part: 'media' | 'copy' | 'general', text: string, authorName: string) {
    if (!text.trim()) {
      toast({ title: 'Escreva o que precisa ajustar', variant: 'destructive' });
      return;
    }
    const { error: cErr } = await supabase.from('content_comments').insert({
      content_id: contentId,
      target: part,
      text: text.trim(),
      author_name: authorName.trim() || 'Cliente',
    });
    if (cErr) { toast({ title: 'Erro ao enviar comentário', variant: 'destructive' }); return; }

    if (part !== 'general') {
      const patch: any = part === 'media' ? { media_status: 'change_requested' } : { copy_status: 'change_requested' };
      await supabase.from('contents').update({ ...patch, status: 'revision' as any }).eq('id', contentId);
    }
    toast({ title: '📝 Comentário enviado!' });
    loadPortalData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-500 text-lg">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 border-slate-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Acesso negado</h2>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingApproval = projects.flatMap(p => p.contents.filter(c => c.status === 'in_review'));
  const allContents = projects.flatMap(p => p.contents);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Racun<span className="text-violet-600">.</span>
            </h1>
            <p className="text-sm text-slate-500">Portal do Cliente</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-800">{client?.name}</p>
            {client?.company && (
              <p className="text-sm text-slate-500 flex items-center gap-1 justify-end">
                <Building2 className="h-3 w-3" /> {client.company}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-slate-800">{projects.length}</p>
              <p className="text-sm text-slate-500">Projetos</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-slate-800">{allContents.length}</p>
              <p className="text-sm text-slate-500">Conteúdos</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{pendingApproval.length}</p>
              <p className="text-sm text-amber-600">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {allContents.filter(c => c.status === 'approved' || c.status === 'published').length}
              </p>
              <p className="text-sm text-emerald-600">Aprovados</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending approval alert */}
        {pendingApproval.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">
                  Você tem {pendingApproval.length} conteúdo(s) aguardando aprovação
                </p>
                <p className="text-sm text-amber-600">Revise e aprove ou solicite alterações abaixo.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="approval" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="approval" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Aprovações {pendingApproval.length > 0 && `(${pendingApproval.length})`}
            </TabsTrigger>
            <TabsTrigger value="contents" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Todos os Conteúdos
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Projetos
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Faturas
            </TabsTrigger>
          </TabsList>

          {/* Approvals Tab */}
          <TabsContent value="approval" className="space-y-4">
            {pendingApproval.length === 0 ? (
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700">Tudo em dia!</p>
                  <p className="text-slate-500">Nenhum conteúdo aguardando sua aprovação.</p>
                </CardContent>
              </Card>
            ) : (
              pendingApproval.map(content => (
                <ContentApprovalCard
                  key={content.id}
                  content={content}
                  projectName={projects.find(p => p.id === content.project_id)?.name ?? ''}
                  comment={comment[content.id] ?? ''}
                  onCommentChange={(text) => setComment(prev => ({ ...prev, [content.id]: text }))}
                  onApprove={() => handleApprove(content.id)}
                  onRequestRevision={() => handleRequestRevision(content.id)}
                />
              ))
            )}
          </TabsContent>

          {/* All Contents Tab */}
          <TabsContent value="contents" className="space-y-3">
            {allContents.length === 0 ? (
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-8 text-center text-slate-500">
                  Nenhum conteúdo disponível.
                </CardContent>
              </Card>
            ) : (
              allContents.map(content => {
                const status = contentStatusConfig[content.status] ?? { label: content.status, color: '', icon: Clock };
                const StatusIcon = status.icon;
                return (
                  <Card key={content.id} className="border-slate-200 bg-white hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-4">
                        <StatusIcon className={`h-5 w-5 shrink-0 ${status.color.includes('emerald') ? 'text-emerald-500' : status.color.includes('amber') ? 'text-amber-500' : status.color.includes('purple') ? 'text-purple-500' : 'text-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{content.title}</p>
                          <p className="text-sm text-slate-500">
                            {projects.find(p => p.id === content.project_id)?.name} • {typeLabels[content.type] ?? content.type}
                          </p>
                        </div>
                        <Badge variant="outline" className={status.color}>{status.label}</Badge>
                      </div>
                      {content.drive_url && getDrivePreviewUrl(content.drive_url) && (
                        <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video">
                          <iframe src={getDrivePreviewUrl(content.drive_url)!} className="w-full h-full" allow="autoplay" allowFullScreen title={content.title} />
                        </div>
                      )}
                      {content.files && content.files.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {content.files.slice(0, 8).map(f => {
                            const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name);
                            const isVid = /\.(mp4|mov|webm|avi|mkv)$/i.test(f.name);
                            return (
                              <a key={f.name} href={f.url} target="_blank" rel="noopener noreferrer"
                                className="block rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                                {isImg ? (
                                  <img src={f.url} alt={f.name} className="w-full h-20 object-cover" />
                                ) : isVid ? (
                                  <video src={f.url} className="w-full h-20 object-cover" />
                                ) : (
                                  <div className="w-full h-20 flex items-center justify-center text-slate-400">
                                    <FileText className="h-6 w-6" />
                                  </div>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4">
            {projects.map(project => (
              <Card key={project.id} className="border-slate-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <FolderKanban className="h-5 w-5 text-violet-500" />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-slate-600">{project.contents.length} conteúdos</Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                      {project.contents.filter(c => c.status === 'approved' || c.status === 'published').length} aprovados
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      {project.contents.filter(c => c.status === 'in_review').length} pendentes
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {projects.length === 0 && (
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-8 text-center text-slate-500">Nenhum projeto encontrado.</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-3">
            {invoicesData.length === 0 ? (
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-8 text-center text-slate-500">
                  Nenhuma fatura disponível.
                </CardContent>
              </Card>
            ) : (
              invoicesData.map((inv: any) => {
                const statusMap: Record<string, { label: string; color: string }> = {
                  pending: { label: 'Pendente', color: 'bg-amber-50 text-amber-600 border-amber-200' },
                  paid: { label: 'Pago', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                  overdue: { label: 'Atrasado', color: 'bg-red-50 text-red-600 border-red-200' },
                  cancelled: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 border-slate-200' },
                };
                const st = statusMap[inv.status] ?? statusMap.pending;
                return (
                  <Card key={inv.id} className="border-slate-200 bg-white hover:shadow-sm transition-shadow">
                    <CardContent className="flex items-center gap-4 p-4">
                      <DollarSign className="h-5 w-5 text-violet-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{inv.title}</p>
                        <p className="text-sm text-slate-500">
                          Vencimento: {new Date(inv.due_date).toLocaleDateString('pt-BR')} •{' '}
                          {Number(inv.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      <Badge variant="outline" className={st.color}>{st.label}</Badge>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-slate-400">
          Powered by <span className="font-semibold text-slate-600">Racun</span>
        </div>
      </footer>
    </div>
  );
}

function ContentApprovalCard({
  content,
  projectName,
  comment,
  onCommentChange,
  onApprove,
  onRequestRevision,
}: {
  content: ContentData;
  projectName: string;
  comment: string;
  onCommentChange: (text: string) => void;
  onApprove: () => void;
  onRequestRevision: () => void;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string; type: 'image' | 'video' } | null>(null);
  const drivePreview = content.drive_url ? getDrivePreviewUrl(content.drive_url) : null;
  const images = (content.files ?? []).filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name));
  const videos = (content.files ?? []).filter(f => /\.(mp4|mov|webm|avi|mkv)$/i.test(f.name));
  const others = (content.files ?? []).filter(f =>
    !/\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|avi|mkv)$/i.test(f.name)
  );

  return (
    <>
      <Card className="border-slate-200 bg-white overflow-hidden">
        <div className="h-1 bg-amber-400" />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-slate-800">{content.title}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {projectName} • {typeLabels[content.type] ?? content.type}
              </p>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
              Aguardando aprovação
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Drive video preview */}
          {content.drive_url && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Video className="h-3 w-3" /> Vídeo (Google Drive)
                </p>
                <a
                  href={content.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir no Drive
                </a>
              </div>
              {drivePreview ? (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video">
                  <iframe
                    src={drivePreview}
                    className="w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    title={content.title}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <Video className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">
                    Não conseguimos exibir este link aqui. Abra direto no Drive.
                  </p>
                  <a
                    href={content.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    <ExternalLink className="h-4 w-4" /> Ver vídeo no Google Drive
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Image gallery (thumbnails -> modal) */}
          {images.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Imagens ({images.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map(f => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setLightbox({ url: f.url, name: f.name, type: 'image' })}
                    className="group relative block rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <img
                      src={f.url}
                      alt={f.name}
                      loading="lazy"
                      className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video files */}
          {videos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Vídeos ({videos.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {videos.map(f => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setLightbox({ url: f.url, name: f.name, type: 'video' })}
                    className="group block rounded-lg overflow-hidden border border-slate-200 bg-black focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <video src={f.url} className="w-full h-32 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Other files */}
          {others.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {others.map(f => (
                <a
                  key={f.name}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <FileText className="h-3 w-3" />
                  {f.name.replace(/^\d+_/, '')}
                </a>
              ))}
            </div>
          )}

          {content.description && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{content.description}</p>
          )}

          {/* Checklist display */}
          {content.checklist && Array.isArray(content.checklist) && content.checklist.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Checklist da equipe:</p>
              <div className="space-y-1">
                {(content.checklist as any[]).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    {item.checked ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-300" />
                    )}
                    <span className={item.checked ? 'text-slate-600' : 'text-slate-400'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment for revision */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
              <MessageSquare className="h-4 w-4" /> Comentário (para revisão)
            </label>
            <Textarea
              placeholder="Descreva o que precisa ser ajustado..."
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              className="border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none"
              rows={2}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onApprove}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Aprovar
            </Button>
            <Button
              onClick={onRequestRevision}
              variant="outline"
              className="flex-1 border-amber-300 text-amber-600 hover:bg-amber-50"
            >
              <Send className="mr-2 h-4 w-4" /> Solicitar Revisão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lightbox modal */}
      <Dialog open={!!lightbox} onOpenChange={open => !open && setLightbox(null)}>
        <DialogContent className="max-w-5xl bg-black border-slate-800 p-2">
          {lightbox?.type === 'image' && (
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="w-full max-h-[85vh] object-contain rounded"
            />
          )}
          {lightbox?.type === 'video' && (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="w-full max-h-[85vh] rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
