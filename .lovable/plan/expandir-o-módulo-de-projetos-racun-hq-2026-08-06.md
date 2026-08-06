# Expandir o módulo de Projetos (Racun HQ)

## 1. O que já existe hoje (análise)

### Banco de dados
Tabela `projects` (já criada, NÃO será recriada):
- `id`, `name`, `client_id` (liga na tabela `clients`, não é `client_name` em texto)
- `status` (enum `project_status`: briefing, in_progress, review, completed, paused, cancelled)
- `priority` (enum: low, medium, high, urgent)
- `deadline` (data) — já existe
- `description` (texto) — já existe
- `created_by`, `created_at`, `updated_at`

Ou seja: **deadline e description já existem**. Do item 1 do seu pedido, só falta o status "atrasado".

Tabelas relacionadas que já existem e serão reaproveitadas:
- `contents` (conteúdos do projeto, com `drive_url`, status de mídia e copy, checklist)
- `content_versions`, `content_comments` (versões e comentários)
- `project_templates` (modelos com checklist e conteúdos padrão)
- `client_assignments` + funções `can_access_client` / `can_edit_client` — o controle de acesso hoje é **por cliente**, não por projeto
- `user_roles` (admin, manager, editor, viewer, financeiro, social_media, client)
- `activity_logs` (log genérico) e `client_notifications` (notificações vindas do portal do cliente)
- `tags` / `project_tags`

### Código
- Rotas: `/projects` (lista) e `/projects/:id` (detalhe), em `src/App.tsx`
- `src/pages/Projects.tsx` — grid de cards, busca, criação/duplicação de projeto, barra de prazo
- `src/pages/ProjectDetail.tsx` — hoje é focado em **conteúdos** (criar conteúdo, upload de arquivos no bucket `content-files`, preview de vídeo do Drive, checklist)
- `src/pages/ClientDetail.tsx` — Client Hub, com aba de Projetos
- `src/components/layout/QuickCreateFab.tsx` — criação rápida de projeto
- `src/hooks/useAuth.tsx` — expõe `role` do usuário
- Padrão de dados: chamadas diretas ao cliente Supabase dentro das páginas (sem camada de hooks por entidade)

## 2. Proposta de encaixe (reaproveitando o máximo)

### Banco — alterações em tabelas existentes
- Adicionar o valor `delayed` (atrasado) ao enum `project_status`
- Nada mais a mudar em `projects`

### Banco — tabelas novas
- `project_stages` — id, project_id, name, order_index, assigned_role (enum já existente `app_role`), status (not_started / in_progress / completed), started_at, completed_at, expected_duration_hours
- `project_access` — id, project_id, user_id, role, can_edit (complementa `client_assignments`, sem substituí-lo: acesso por cliente continua valendo para admin/gestor)
- `project_links` — id, project_id, stage_id (opcional), title, url, type (drive/arquivo/referencia/outro), added_by, created_at
- `project_updates` — id, project_id, stage_id, user_id, message, created_at
- `notifications` — id, user_id, project_id, stage_id, type (stage_completed / deadline_near / overdue / stalled), read, created_at
  (a `client_notifications` continua existindo só para eventos do portal do cliente)

### Banco — RLS (regras de acesso)
Função nova `can_access_project(user, project)` e `can_edit_project_stage(user, stage)`, em SQL security definer, cruzando:
- admin → tudo
- quem já tem acesso pelo cliente (`can_access_client`) → mantém acesso
- quem está em `project_access` → vê o projeto; edita fases só se `can_edit = true` **e** `assigned_role` bater com seu papel
- `visualizador` → apenas leitura

Links, updates e fases: leitura para quem tem acesso ao projeto; escrita conforme a regra da fase.

### Código — o que reaproveita e o que é novo
Reaproveitar (só editar):
- `src/pages/Projects.tsx` — adicionar coluna/badge de **fase atual** e indicador de atraso nos cards existentes
- `src/pages/ProjectDetail.tsx` — passar a ter abas: **Fluxo (fases)**, **Conteúdos** (o que já existe hoje, intacto), **Links**, **Histórico**, **Acesso**
- `src/components/layout/AppLayout.tsx` — sininho de notificações no topo
- `src/hooks/useAuth.tsx` — usado para saber o papel e montar a visão do editor

Componentes novos (só o que realmente é novo):
- `src/components/projects/StageTimeline.tsx` — stepper das fases com "Iniciar fase" / "Concluir e avançar" e campo de atualização
- `src/components/projects/ProjectLinksPanel.tsx` — links agrupados por fase
- `src/components/projects/ProjectUpdatesFeed.tsx` — histórico
- `src/components/projects/ProjectAccessPanel.tsx` — quem tem acesso (admin)
- `src/components/notifications/NotificationBell.tsx` — contador de não lidas
- `src/lib/projectTiming.ts` — `calculateProjectTiming(project, stages)`: tempo por fase, comparação com o previsto, total acumulado, tempo restante até o deadline e cor (verde/amarelo/vermelho)
- `src/pages/MyWork.tsx` (rota `/meu-trabalho`) — painel do editor/social media, só com projetos e fases dele

### Automações
- Trigger no banco: ao concluir uma fase grava `completed_at`, libera a próxima (`in_progress`) e cria notificação para os admins
- Fases padrão (Captação → Decupagem → Edição Bruta → Revisão Interna → Ajustes → Aprovação Cliente → Entrega Final) criadas via botão "Gerar fluxo padrão" no projeto, com papel sugerido por fase
- Prazo próximo (padrão 3 dias), atraso e fase parada (>48h) calculados por uma função agendada diária que grava em `notifications`

## 3. Ordem de execução
1. Migration 1: enum `delayed` + as 5 tabelas novas com GRANTs e RLS
2. Migration 2: funções de acesso, trigger de conclusão de fase
3. `src/lib/projectTiming.ts` + componentes novos
4. Edição de `ProjectDetail.tsx` (abas) e `Projects.tsx` (fase atual/atraso)
5. Sininho de notificações + rota `/meu-trabalho`
6. Job diário de prazos/gargalos

Cada migration será mostrada para você aprovar antes de rodar.
