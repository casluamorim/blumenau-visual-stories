import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, ArrowLeft, CheckCircle, AlertTriangle, FileText, Upload,
  Image, Video, Trash2, ExternalLink, Loader2, Link2
} from 'lucide-react';
import { getDrivePreviewUrl, isDriveUrl } from '@/lib/drive';
import type { Database } from '@/integrations/supabase/types';

type Content = Database['public']['Tables']['contents']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

const contentStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  in_review: { label: 'Em Revisão', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  revision: { label: 'Correção', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  approved: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  published: { label: 'Publicado', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

const typeLabels: Record<string, string> = {
  photo: 'Foto', video: 'Vídeo', reels: 'Reels', stories: 'Stories',
  carousel: 'Carrossel', cover: 'Capa', banner: 'Banner', other: 'Outro',
};

const defaultChecklist = [
  { id: '1', label: 'Legenda revisada', checked: false },
  { id: '2', label: 'Formato correto', checked: false },
  { id: '3', label: 'Qualidade validada', checked: false },
];

interface ContentFile {
  name: string;
  url: string;
  contentId: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { clients: { name: string } | null }) | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contentFiles, setContentFiles] = useState<Record<string, ContentFile[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: '', type: 'photo' as any, priority: 'medium' as any, deadline: '',
    revision_limit: 3, description: '', drive_url: '',
    caption: '', internal_notes: '',
  });

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const [p, c] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').eq('id', id!).single(),
      supabase.from('contents').select('*').eq('project_id', id!).order('created_at', { ascending: false }),
    ]);
    setProject(p.data as any);
    const contentsList = c.data ?? [];
    setContents(contentsList);

    // Load files for all contents
    const filesMap: Record<string, ContentFile[]> = {};
    for (const content of contentsList) {
      const { data: files } = await supabase.storage
        .from('content-files')
        .list(`${id}/${content.id}`);

      if (files?.length) {
        filesMap[content.id] = files.map(f => ({
          name: f.name,
          url: supabase.storage.from('content-files').getPublicUrl(`${id}/${content.id}/${f.name}`).data.publicUrl,
          contentId: content.id,
        }));
      }
    }
    setContentFiles(filesMap);
  }

  async function handleCreateContent() {
    if (!form.title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('contents').insert({
      ...form,
      drive_url: form.drive_url.trim() || null,
      caption: form.caption.trim() || null,
      internal_notes: form.internal_notes.trim() || null,
      project_id: id!,
      deadline: form.deadline || null,
      checklist: defaultChecklist,
      created_by: user?.id,
    } as any);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Conteúdo criado!' });
    setForm({ title: '', type: 'photo', priority: 'medium', deadline: '', revision_limit: 3, description: '', drive_url: '', caption: '', internal_notes: '' });
    setDialogOpen(false);
    loadData();
  }

  async function updateContentStatus(contentId: string, status: string) {
    const { error } = await supabase.from('contents').update({ status: status as any }).eq('id', contentId);
    if (error) { toast({ title: 'Erro', variant: 'destructive' }); return; }
    loadData();
  }

  async function toggleChecklist(contentId: string, checklist: any[], index: number) {
    const updated = [...checklist];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    await supabase.from('contents').update({ checklist: updated }).eq('id', contentId);
    loadData();
  }

  async function handleFileUpload(contentId: string, files: FileList | null) {
    if (!files?.length) return;
    setUploading(contentId);

    for (const file of Array.from(files)) {
      const filePath = `${id}/${contentId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('content-files')
        .upload(filePath, file, { upsert: false });

      if (error) {
        toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      }
    }

    toast({ title: `${files.length} arquivo(s) enviado(s)!` });
    setUploading(null);
    loadData();
  }

  async function handleDeleteFile(contentId: string, fileName: string) {
    const filePath = `${id}/${contentId}/${fileName}`;
    const { error } = await supabase.storage.from('content-files').remove([filePath]);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Arquivo excluído' });
    loadData();
  }

  function isImage(name: string) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
  }

  function isVideo(name: string) {
    return /\.(mp4|mov|webm|avi|mkv)$/i.test(name);
  }

  if (!project) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/projects">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground">{project.clients?.name}</p>
          </div>
        </div>

        {/* Content List Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Conteúdos ({contents.length})
          </h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo Conteúdo</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="text-foreground">Novo Conteúdo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-muted border-border" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                      <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="bg-muted border-border" /></div>
                  <div><Label>Limite revisões</Label><Input type="number" min={1} value={form.revision_limit} onChange={e => setForm({ ...form, revision_limit: Number(e.target.value) })} className="bg-muted border-border" /></div>
                </div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-muted border-border" /></div>
                <div>
                  <Label>✍️ Copy / Legenda</Label>
                  <Textarea
                    placeholder="Texto que vai junto com o post (cliente irá aprovar separadamente)"
                    value={form.caption}
                    onChange={e => setForm({ ...form, caption: e.target.value })}
                    rows={3}
                    className="bg-muted border-border"
                  />
                </div>
                <div>
                  <Label>🧾 Observações internas (só equipe)</Label>
                  <Textarea
                    placeholder="Notas internas — o cliente NÃO vê"
                    value={form.internal_notes}
                    onChange={e => setForm({ ...form, internal_notes: e.target.value })}
                    rows={2}
                    className="bg-muted border-border"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Link2 className="h-3 w-3" /> Link do Google Drive (vídeo)</Label>
                  <Input
                    placeholder="https://drive.google.com/file/d/.../view"
                    value={form.drive_url}
                    onChange={e => setForm({ ...form, drive_url: e.target.value })}
                    className="bg-muted border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cole o link de compartilhamento do Drive. O vídeo abrirá embutido para o cliente.
                  </p>
                </div>
                <Button onClick={handleCreateContent} className="w-full">Criar Conteúdo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Contents */}
        <div className="space-y-4">
          {contents.map(content => {
            const status = contentStatusConfig[content.status] ?? { label: content.status, color: '' };
            const checklist = (content.checklist as any[]) ?? [];
            const checklistDone = checklist.filter((c: any) => c.checked).length;
            const revisionWarning = content.revision_count !== null && content.revision_limit !== null && content.revision_count >= content.revision_limit;
            const files = contentFiles[content.id] ?? [];

            return (
              <Card key={content.id} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {content.title}
                        {revisionWarning && (
                          <span className="flex items-center gap-1 text-xs text-amber-400" title="Limite de revisões atingido">
                            <AlertTriangle className="h-3 w-3" /> Limite atingido
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{typeLabels[content.type] ?? content.type}</Badge>
                        <Badge variant="outline" className={status.color}>{status.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Revisões: {content.revision_count ?? 0}/{content.revision_limit ?? 3}
                        </span>
                        {files.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Image className="h-3 w-3" /> {files.length} arquivo(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Select value={content.status} onValueChange={v => updateContentStatus(content.id, v)}>
                        <SelectTrigger className="h-8 w-32 text-xs bg-muted border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(contentStatusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Checklist */}
                  {checklist.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Checklist ({checklistDone}/{checklist.length})
                      </p>
                      <div className="space-y-2">
                        {checklist.map((item: any, idx: number) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() => toggleChecklist(content.id, checklist, idx)}
                            />
                            <span className={`text-sm ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {files.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Arquivos</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {files.map(file => (
                          <div key={file.name} className="group relative rounded-lg border border-border overflow-hidden bg-muted">
                            {isImage(file.name) ? (
                              <img src={file.url} alt={file.name} className="w-full h-28 object-cover" />
                            ) : isVideo(file.name) ? (
                              <video src={file.url} className="w-full h-28 object-cover" />
                            ) : (
                              <div className="w-full h-28 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="p-1.5">
                              <p className="text-xs text-muted-foreground truncate">{file.name.replace(/^\d+_/, '')}</p>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={file.url} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded bg-background/80 hover:bg-background">
                                <ExternalLink className="h-3 w-3 text-foreground" />
                              </a>
                              <button onClick={() => handleDeleteFile(content.id, file.name)}
                                className="p-1 rounded bg-background/80 hover:bg-background">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drive video preview */}
                  {(content as any).drive_url && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Video className="h-3 w-3" /> Vídeo (Google Drive)
                      </p>
                      {getDrivePreviewUrl((content as any).drive_url) ? (
                        <div className="rounded-lg overflow-hidden border border-border bg-black aspect-video">
                          <iframe
                            src={getDrivePreviewUrl((content as any).drive_url)!}
                            className="w-full h-full"
                            allow="autoplay"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a href={(content as any).drive_url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Abrir no Drive
                        </a>
                      )}
                    </div>
                  )}

                  {/* Upload button */}
                  <FileUploadButton
                    contentId={content.id}
                    uploading={uploading === content.id}
                    onUpload={handleFileUpload}
                  />
                </CardContent>
              </Card>
            );
          })}
          {contents.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum conteúdo neste projeto. Crie o primeiro!
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function FileUploadButton({ contentId, uploading, onUpload }: {
  contentId: string; uploading: boolean;
  onUpload: (contentId: string, files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.psd,.ai,.svg"
        className="hidden"
        onChange={e => { onUpload(contentId, e.target.files); e.target.value = ''; }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="border-dashed"
      >
        {uploading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
        ) : (
          <><Upload className="mr-2 h-4 w-4" /> Anexar Arquivos</>
        )}
      </Button>
    </div>
  );
}
