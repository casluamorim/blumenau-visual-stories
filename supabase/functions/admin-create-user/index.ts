// Admin cria usuários direto (email + senha + função), sem convite/link.
// Acesso: somente usuários com role 'admin'.

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

type AppRole =
  | "admin" | "manager" | "editor" | "viewer" | "financeiro" | "social_media";

const VALID_ROLES: AppRole[] = [
  "admin", "manager", "editor", "viewer", "financeiro", "social_media",
];

interface Body {
  email?: string;
  password?: string;
  full_name?: string;
  role?: AppRole;
}

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("method not allowed", 405);

  // Auth caller as admin
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

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return bad("admin only", 403);

  // Parse + validate body
  let body: Body;
  try { body = await req.json(); } catch { return bad("invalid json"); }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  const role = body.role as AppRole;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return bad("e-mail inválido");
  if (password.length < 8) return bad("senha precisa ter no mínimo 8 caracteres");
  if (!fullName) return bad("nome completo é obrigatório");
  if (!VALID_ROLES.includes(role)) return bad("função inválida");

  // Create auth user (já confirmado, login imediato pelo usuário criado)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) {
    return bad(createErr?.message ?? "falha ao criar usuário", 400);
  }

  const newUserId = created.user.id;

  // Garante profile com nome correto e role textual (trigger handle_new_user
  // já cria, mas pode usar default 'editor'; sobrescrevemos).
  await admin.from("profiles").upsert(
    {
      user_id: newUserId,
      full_name: fullName,
      email,
      role: role,
      is_active: true,
    },
    { onConflict: "user_id" },
  );

  // Limpa quaisquer roles e atribui exatamente o solicitado
  await admin.from("user_roles").delete().eq("user_id", newUserId);
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: newUserId, role });
  if (roleErr) {
    // rollback do usuário criado
    await admin.auth.admin.deleteUser(newUserId);
    return bad(`falha ao atribuir função: ${roleErr.message}`, 500);
  }

  // Audit log
  await admin.from("activity_logs").insert({
    action: "user.created",
    entity_type: "user",
    entity_id: newUserId,
    user_id: userData.user.id,
    details: { email, full_name: fullName, role },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      user: { id: newUserId, email, full_name: fullName, role },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
