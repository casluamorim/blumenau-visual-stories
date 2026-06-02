// Admin cria/regenera acesso por e-mail e senha para um cliente.
// Cria o usuário no Auth, atribui a role 'client', vincula em clients.auth_user_id,
// e retorna um link de definição/redefinição de senha (recovery) para o admin enviar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Body {
  client_id?: string;
  email?: string;
  redirect_to?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad("missing auth", 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData.user) return bad("invalid token", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminRole } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!adminRole) return bad("admin only", 403);

  let body: Body;
  try { body = await req.json(); } catch { return bad("invalid json"); }

  const client_id = (body.client_id ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const redirect_to = body.redirect_to ?? "";

  if (!client_id) return bad("client_id obrigatório");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return bad("e-mail inválido");
  if (!redirect_to) return bad("redirect_to obrigatório");

  // Buscar cliente
  const { data: clientRow, error: clientErr } = await admin
    .from("clients").select("id, name, auth_user_id").eq("id", client_id).maybeSingle();
  if (clientErr || !clientRow) return bad("cliente não encontrado", 404);

  let userId = clientRow.auth_user_id as string | null;

  // Tentar achar usuário existente por e-mail
  if (!userId) {
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) userId = found.id;
  }

  // Criar se não existe
  if (!userId) {
    const tempPwd = crypto.randomUUID() + "Aa1!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPwd,
      email_confirm: true,
      user_metadata: { full_name: clientRow.name, account_type: "client" },
    });
    if (createErr || !created.user) return bad(createErr?.message ?? "falha ao criar usuário", 400);
    userId = created.user.id;
  } else {
    // Garante que email do auth bate
    await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  }

  // Garante role 'client' (e remove possíveis roles antigas conflitantes? não, só garante client)
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "client");
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "client" });
  if (roleErr) return bad(`falha ao atribuir função: ${roleErr.message}`, 500);

  // Vincula cliente
  await admin.from("clients").update({ auth_user_id: userId, email }).eq("id", client_id);

  // Garante profile mínimo
  await admin.from("profiles").upsert(
    { user_id: userId, full_name: clientRow.name, email, role: "client", is_active: true },
    { onConflict: "user_id" },
  );

  // Gera link de recovery (define senha)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: redirect_to },
  });
  if (linkErr) return bad(`falha ao gerar link: ${linkErr.message}`, 500);

  await admin.from("activity_logs").insert({
    action: "client.access_created",
    entity_type: "client",
    entity_id: client_id,
    user_id: userData.user.id,
    details: { email },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      action_link: linkData?.properties?.action_link ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
