## Objetivo
Adicionar um novo tipo de acesso "Cliente" no sistema, usando a MESMA tela de login atual (email + senha). O sistema detecta automaticamente o tipo de usuário (admin / funcionário / cliente) e redireciona corretamente. O acesso atual por link público (`/portal/:slug`) continua funcionando intacto.

## Mudanças no banco

1. Nova role `client` no enum `app_role`.
2. Tabela `clients`: adicionar coluna `auth_user_id uuid` (nullable, unique) ligando o cliente a um usuário do `auth.users`.
3. Atualizar funções `can_access_client` / `can_edit_client` para que um usuário com role `client` só enxergue/edite o cliente cujo `auth_user_id = auth.uid()`.
4. Novas policies para `projects`, `contents`, `content_versions`, `comments`, `content_comments`, `invoices`, `quotes` — permitindo SELECT quando o usuário autenticado é o cliente dono (via `clients.auth_user_id = auth.uid()`).
5. Trigger / função auxiliar `is_client_of(client_id)` para reaproveitar nas policies.

## Edge function `client-create-access`
- Chamada pelo admin a partir da tela de Clientes, botão **"Enviar acesso"** / **"Gerar login"**.
- Recebe `{ client_id, email }`.
- Valida que quem chama é admin.
- Cria usuário no `auth.users` via service role (sem senha — usa `inviteUserByEmail` OU cria com senha temporária + envia recovery). Vamos usar `admin.generateLink({ type: 'invite' })` para obter um link de definição de senha, ou simplesmente criar o usuário sem confirmar e usar `resetPasswordForEmail`.
- Insere role `client` em `user_roles`.
- Faz `update clients set auth_user_id = newUser.id, email = email where id = client_id`.
- Retorna o link de primeiro acesso (admin pode copiar e enviar).

## Frontend

### Tela de login atual (`Auth.tsx`)
- Continua igual visualmente.
- Após `signIn`, novo hook detecta a role do usuário; se `client`, redireciona para `/portal-cliente` (rota interna do cliente autenticado).
- Adicionar link **"Esqueci minha senha"** (usa `resetPasswordForEmail`) e tela `/reset-password` para definir nova senha.
- Adicionar tela `/definir-senha` para primeiro acesso (cliente que recebeu link de invite).

### Roteamento (`App.tsx`)
- Adicionar `/portal-cliente` (área autenticada do cliente — reutiliza `ClientPortal` parametrizado pelo cliente atual do usuário logado).
- Adicionar `/reset-password` e `/definir-senha` (rotas públicas, fora do `AuthProvider` autenticado de admin).
- Em `AppRoutes`, se `role === 'client'`, renderizar apenas as rotas do portal do cliente (bloquear dashboard/financeiro/etc).

### Portal do cliente autenticado
- Nova página fina `ClientPortalAuth.tsx` que descobre `client_id` via `select id, slug from clients where auth_user_id = auth.uid()` e renderiza o `ClientPortal` existente passando o slug (sem alterar `ClientPortal.tsx`).

### Página de Clientes (`Clients.tsx`)
- Novo botão por cliente: **"Acesso por senha"** que abre modal:
  - Input email (pré-preenchido com `client.email`).
  - Botão **"Gerar acesso"** → chama edge function → mostra link de primeiro acesso para copiar.
  - Se cliente já tem `auth_user_id`: mostra status "Login ativo (email@x)" + botão **"Reenviar link de redefinição de senha"**.

## Segurança
- Isolamento total via RLS — cliente só vê dados onde `clients.auth_user_id = auth.uid()`.
- Rotas frontend bloqueadas por role no `AppRoutes`.
- Acesso por token público (`/portal/:slug`) permanece inalterado.

## Não-mudanças (preservar)
- `Auth.tsx` mantém visual.
- Fluxo admin/funcionário inalterado.
- `ClientPortal.tsx` não é reescrito.
- `admin-create-user` continua igual.
- Link público `/portal/:slug` continua igual.

## Ordem de implementação
1. Migration: enum, coluna `auth_user_id`, funções, policies.
2. Edge function `client-create-access`.
3. Frontend: roteamento, login redirect por role, página de definir/reset senha, portal cliente autenticado, botão no `Clients.tsx`.