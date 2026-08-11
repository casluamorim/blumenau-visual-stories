CREATE TABLE public.stage_flow_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_flow_presets TO authenticated;
GRANT ALL ON public.stage_flow_presets TO service_role;

ALTER TABLE public.stage_flow_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presets"
  ON public.stage_flow_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert presets"
  ON public.stage_flow_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update presets"
  ON public.stage_flow_presets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete presets"
  ON public.stage_flow_presets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_stage_flow_presets_updated_at
  BEFORE UPDATE ON public.stage_flow_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS work_type text;

INSERT INTO public.stage_flow_presets (key, label, description, order_index, stages) VALUES
('audiovisual','Audiovisual','Captação, decupagem, edição, aprovação e entrega.',1,'[
 {"name":"Captação","assigned_role":"editor","expected_duration_hours":8},
 {"name":"Decupagem","assigned_role":"editor","expected_duration_hours":4},
 {"name":"Edição Bruta","assigned_role":"editor","expected_duration_hours":12},
 {"name":"Revisão Interna","assigned_role":"admin","expected_duration_hours":4},
 {"name":"Ajustes","assigned_role":"editor","expected_duration_hours":6},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Entrega Final","assigned_role":"admin","expected_duration_hours":2}]'::jsonb),
('social_media','Social Media (mensal)','Planejamento, roteiro, captação, edição, aprovação e postagem.',2,'[
 {"name":"Planejamento do mês","assigned_role":"social_media","expected_duration_hours":4},
 {"name":"Roteiro","assigned_role":"social_media","expected_duration_hours":6},
 {"name":"Captação (Audiovisual)","assigned_role":"editor","expected_duration_hours":8},
 {"name":"Edição dos materiais","assigned_role":"editor","expected_duration_hours":12},
 {"name":"Montagem dos posts","assigned_role":"social_media","expected_duration_hours":6},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Agendamento / Postagem","assigned_role":"social_media","expected_duration_hours":3}]'::jsonb),
('fotografia','Fotografia','Briefing, sessão, seleção, edição e entrega.',3,'[
 {"name":"Briefing","assigned_role":"fotografo","expected_duration_hours":2},
 {"name":"Planejamento de locação","assigned_role":"fotografo","expected_duration_hours":3},
 {"name":"Sessão de fotos","assigned_role":"fotografo","expected_duration_hours":6},
 {"name":"Seleção e edição","assigned_role":"fotografo","expected_duration_hours":8},
 {"name":"Revisão Interna","assigned_role":"admin","expected_duration_hours":2},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Entrega final","assigned_role":"fotografo","expected_duration_hours":2}]'::jsonb),
('gestao_anuncios','Gestão de Anúncios','Briefing, estratégia, criativos, campanha, otimização e relatório.',4,'[
 {"name":"Briefing e objetivos","assigned_role":"gestor_anuncios","expected_duration_hours":2},
 {"name":"Estratégia de público e budget","assigned_role":"gestor_anuncios","expected_duration_hours":4},
 {"name":"Criação de criativos","assigned_role":"designer","expected_duration_hours":8},
 {"name":"Configuração da campanha","assigned_role":"gestor_anuncios","expected_duration_hours":4},
 {"name":"Veiculação e acompanhamento","assigned_role":"gestor_anuncios","expected_duration_hours":12},
 {"name":"Otimização","assigned_role":"gestor_anuncios","expected_duration_hours":6},
 {"name":"Relatório final","assigned_role":"gestor_anuncios","expected_duration_hours":3}]'::jsonb),
('design','Design Gráfico','Briefing, criação, revisão, ajustes e arquivos finais.',5,'[
 {"name":"Briefing","assigned_role":"designer","expected_duration_hours":2},
 {"name":"Criação","assigned_role":"designer","expected_duration_hours":10},
 {"name":"Revisão Interna","assigned_role":"admin","expected_duration_hours":2},
 {"name":"Ajustes","assigned_role":"designer","expected_duration_hours":6},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Arquivos finais","assigned_role":"designer","expected_duration_hours":2}]'::jsonb),
('motion','Motion / Animação','Roteiro, storyboard, animação, revisão e render final.',6,'[
 {"name":"Roteiro","assigned_role":"roteirista","expected_duration_hours":4},
 {"name":"Storyboard / frames","assigned_role":"designer","expected_duration_hours":6},
 {"name":"Animação","assigned_role":"motion_designer","expected_duration_hours":16},
 {"name":"Revisão Interna","assigned_role":"admin","expected_duration_hours":4},
 {"name":"Ajustes","assigned_role":"motion_designer","expected_duration_hours":6},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Render final","assigned_role":"motion_designer","expected_duration_hours":3}]'::jsonb),
('producao_conteudo','Produção de Conteúdo','Pesquisa, roteiro, captação, edição, aprovação e publicação.',7,'[
 {"name":"Pesquisa e pauta","assigned_role":"redator","expected_duration_hours":3},
 {"name":"Roteiro","assigned_role":"roteirista","expected_duration_hours":6},
 {"name":"Gravação / Captação","assigned_role":"produtor","expected_duration_hours":8},
 {"name":"Edição","assigned_role":"editor","expected_duration_hours":12},
 {"name":"Revisão","assigned_role":"admin","expected_duration_hours":4},
 {"name":"Aprovação Cliente","assigned_role":"admin","expected_duration_hours":24},
 {"name":"Publicação","assigned_role":"social_media","expected_duration_hours":2}]'::jsonb);