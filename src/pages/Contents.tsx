import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusConfig: Record<string, { label: string; color: string }> = {
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

export default function Contents() {
  const [contents, setContents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadContents(); }, []);

  async function loadContents() {
    const { data } = await supabase
      .from('contents')
      .select('*, projects(name, clients(name))')
      .order('created_at', { ascending: false });
    setContents(data ?? []);
  }

  const filtered = contents.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.projects?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Conteúdos</h1>
          <p className="text-muted-foreground">Todos os conteúdos da agência</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar conteúdos..." value={search} onChange={e => setSearch(e.target.value)} className="bg-muted border-border pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filtered.map(content => {
            const status = statusConfig[content.status] ?? { label: content.status, color: '' };
            const revisionWarning = content.revision_count >= content.revision_limit;

            return (
              <Card key={content.id} className="border-border bg-card hover:border-primary/30 transition-colors">
                <CardContent className="flex items-center gap-4 p-4">
                  <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{content.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {content.projects?.name} • {content.projects?.clients?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{typeLabels[content.type] ?? content.type}</Badge>
                    <Badge variant="outline" className={status.color}>{status.label}</Badge>
                    {revisionWarning && <AlertTriangle className="h-4 w-4 text-amber-400" title="Limite de revisões" />}
                    <Link to={`/projects/${content.project_id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowRight className="h-4 w-4" /></Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">Nenhum conteúdo encontrado.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
