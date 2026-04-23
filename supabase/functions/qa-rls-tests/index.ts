// QA edge function: roda testes de integração contra as RLS policies
// usando usuários reais criados on-the-fly via service_role.
//
// Acesso: somente usuários com role 'admin' podem invocar.
// Cleanup: tudo que é criado é removido no finally, mesmo em caso de falha.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AppRole = "admin" | "financeiro" | "social_media";

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

interface TestUser {
  id: string;
  email: string;
  password: string;
  role: AppRole;
  client: SupabaseClient;
}

const created = {
  users: [] as string[],
  clients: [] as string[],
  invoices: [] as string[],
  expenses: [] as string[],
  incomes: [] as string[],
  projects: [] as string[],
};

async function createTestUser(
  admin: SupabaseClient,
  role: AppRole,
): Promise<TestUser> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `qa-${role}-${suffix}@racun-test.local`;
  const password = `Qa!${crypto.randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `QA ${role} ${suffix}` },
  });
  if (error || !data.user) throw new Error(`createUser ${role}: ${error?.message}`);
  created.users.push(data.user.id);

  // Atribuir role
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: data.user.id, role });
  if (roleErr) throw new Error(`insert role ${role}: ${roleErr.message}`);

  // Cliente autenticado como esse usuário
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) throw new Error(`signIn ${role}: ${signErr.message}`);

  return { id: data.user.id, email, password, role, client: userClient };
}

async function cleanup(admin: SupabaseClient) {
  // Ordem importa por causa de FKs implícitas via id
  for (const id of created.incomes) {
    await admin.from("personal_income").delete().eq("id", id);
  }
  for (const id of created.invoices) {
    await admin.from("invoices").delete().eq("id", id);
  }
  for (const id of created.expenses) {
    await admin.from("expenses").delete().eq("id", id);
  }
  for (const id of created.projects) {
    await admin.from("projects").delete().eq("id", id);
  }
  for (const id of created.clients) {
    await admin.from("clients").delete().eq("id", id);
  }
  for (const userId of created.users) {
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("client_assignments").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

function record(
  results: TestResult[],
  name: string,
  passed: boolean,
  detail?: string,
) {
  results.push({ name, passed, detail });
}

async function runSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Criar 3 usuários de teste
  const adminUser = await createTestUser(adminClient, "admin");
  const finUser = await createTestUser(adminClient, "financeiro");
  const socialUser = await createTestUser(adminClient, "social_media");

  // 2. Criar 2 clientes via service_role (created_by = adminUser para que admin
  //    seja "dono" e tenhamos um cenário realista)
  const { data: clientA, error: ecA } = await adminClient
    .from("clients")
    .insert({ name: `QA Cliente A ${Date.now()}`, created_by: adminUser.id })
    .select()
    .single();
  if (ecA || !clientA) throw new Error(`client A: ${ecA?.message}`);
  created.clients.push(clientA.id);

  const { data: clientB, error: ecB } = await adminClient
    .from("clients")
    .insert({ name: `QA Cliente B ${Date.now()}`, created_by: adminUser.id })
    .select()
    .single();
  if (ecB || !clientB) throw new Error(`client B: ${ecB?.message}`);
  created.clients.push(clientB.id);

  // 3. Vincular social_media SOMENTE ao cliente A
  const { error: assignErr } = await adminClient
    .from("client_assignments")
    .insert({
      client_id: clientA.id,
      user_id: socialUser.id,
      access_level: "edit",
      assigned_by: adminUser.id,
    });
  if (assignErr) throw new Error(`assignment: ${assignErr.message}`);

  // 4. Criar dados financeiros: faturas PJ/PF e despesas PJ/PF
  const { data: invPJ_A } = await adminClient
    .from("invoices")
    .insert({
      title: "QA Fatura PJ A",
      client_id: clientA.id,
      amount: 100,
      due_date: new Date().toISOString().split("T")[0],
      financial_type: "pj",
      created_by: adminUser.id,
    })
    .select()
    .single();
  if (invPJ_A) created.invoices.push(invPJ_A.id);

  const { data: invPF_B } = await adminClient
    .from("invoices")
    .insert({
      title: "QA Fatura PF B",
      client_id: clientB.id,
      amount: 200,
      due_date: new Date().toISOString().split("T")[0],
      financial_type: "pf",
      created_by: adminUser.id,
    })
    .select()
    .single();
  if (invPF_B) created.invoices.push(invPF_B.id);

  const { data: expPJ_A } = await adminClient
    .from("expenses")
    .insert({
      description: "QA Despesa PJ A",
      client_id: clientA.id,
      amount: 50,
      due_date: new Date().toISOString().split("T")[0],
      financial_type: "pj",
      created_by: adminUser.id,
    })
    .select()
    .single();
  if (expPJ_A) created.expenses.push(expPJ_A.id);

  const { data: expPF } = await adminClient
    .from("expenses")
    .insert({
      description: "QA Despesa PF",
      amount: 75,
      due_date: new Date().toISOString().split("T")[0],
      financial_type: "pf",
      created_by: adminUser.id,
    })
    .select()
    .single();
  if (expPF) created.expenses.push(expPF.id);

  // Entrada pessoal (PF) criada pelo admin
  const { data: incAdmin } = await adminClient
    .from("personal_income")
    .insert({
      description: "QA Receita PF Admin",
      amount: 500,
      due_date: new Date().toISOString().split("T")[0],
      created_by: adminUser.id,
    })
    .select()
    .single();
  if (incAdmin) created.incomes.push(incAdmin.id);

  // ============= Testes =============

  // ADMIN
  {
    const { data } = await adminUser.client
      .from("invoices")
      .select("id")
      .in("id", [invPJ_A!.id, invPF_B!.id]);
    record(
      results,
      "admin vê todas as faturas (PJ e PF)",
      (data?.length ?? 0) === 2,
      `viu ${data?.length ?? 0}/2`,
    );
  }
  {
    const { data } = await adminUser.client
      .from("expenses")
      .select("id")
      .in("id", [expPJ_A!.id, expPF!.id]);
    record(
      results,
      "admin vê todas as despesas (PJ e PF)",
      (data?.length ?? 0) === 2,
      `viu ${data?.length ?? 0}/2`,
    );
  }

  // FINANCEIRO
  {
    const { data } = await finUser.client
      .from("invoices")
      .select("id")
      .in("id", [invPJ_A!.id, invPF_B!.id]);
    record(
      results,
      "financeiro vê todas as faturas (PJ e PF)",
      (data?.length ?? 0) === 2,
      `viu ${data?.length ?? 0}/2`,
    );
  }
  {
    const { data } = await finUser.client
      .from("expenses")
      .select("id")
      .in("id", [expPJ_A!.id, expPF!.id]);
    record(
      results,
      "financeiro vê todas as despesas (PJ e PF)",
      (data?.length ?? 0) === 2,
      `viu ${data?.length ?? 0}/2`,
    );
  }
  {
    const { data } = await finUser.client
      .from("personal_income")
      .select("id")
      .eq("id", incAdmin!.id);
    record(
      results,
      "financeiro NÃO vê entradas pessoais (PF) de outros",
      (data?.length ?? 0) === 0,
      `viu ${data?.length ?? 0} (esperado 0)`,
    );
  }

  // SOCIAL_MEDIA
  {
    const { data } = await socialUser.client
      .from("invoices")
      .select("id")
      .eq("id", invPF_B!.id);
    record(
      results,
      "social_media NÃO vê fatura PF de cliente não vinculado",
      (data?.length ?? 0) === 0,
      `viu ${data?.length ?? 0} (esperado 0)`,
    );
  }
  {
    const { data } = await socialUser.client
      .from("invoices")
      .select("id")
      .eq("id", invPJ_A!.id);
    record(
      results,
      "social_media vê fatura PJ do cliente vinculado",
      (data?.length ?? 0) === 1,
      `viu ${data?.length ?? 0} (esperado 1)`,
    );
  }
  {
    const { data } = await socialUser.client
      .from("expenses")
      .select("id")
      .eq("id", expPF!.id);
    record(
      results,
      "social_media NÃO vê despesa PF (sem cliente)",
      (data?.length ?? 0) === 0,
      `viu ${data?.length ?? 0} (esperado 0)`,
    );
  }
  {
    const { data } = await socialUser.client
      .from("personal_income")
      .select("id")
      .eq("id", incAdmin!.id);
    record(
      results,
      "social_media NÃO vê entradas pessoais de outros",
      (data?.length ?? 0) === 0,
      `viu ${data?.length ?? 0} (esperado 0)`,
    );
  }
  {
    const { data } = await socialUser.client
      .from("clients")
      .select("id")
      .eq("id", clientB.id);
    record(
      results,
      "social_media NÃO vê cliente não vinculado",
      (data?.length ?? 0) === 0,
      `viu ${data?.length ?? 0} (esperado 0)`,
    );
  }
  {
    const { data } = await socialUser.client
      .from("clients")
      .select("id")
      .eq("id", clientA.id);
    record(
      results,
      "social_media vê cliente vinculado",
      (data?.length ?? 0) === 1,
      `viu ${data?.length ?? 0} (esperado 1)`,
    );
  }

  // Tentativa de escrita por papel sem permissão
  {
    const { error } = await socialUser.client
      .from("invoices")
      .insert({
        title: "tentativa proibida",
        client_id: clientB.id,
        amount: 1,
        due_date: new Date().toISOString().split("T")[0],
        created_by: socialUser.id,
      });
    // Insert tem WITH CHECK (auth.uid() IS NOT NULL) — ele consegue inserir,
    // mas para validar bloqueio real precisamos checar isolamento de leitura.
    // Aqui validamos UPDATE em fatura alheia:
    const { data: upd } = await socialUser.client
      .from("invoices")
      .update({ title: "hack" })
      .eq("id", invPF_B!.id)
      .select();
    record(
      results,
      "social_media NÃO consegue editar faturas alheias",
      (upd?.length ?? 0) === 0,
      `linhas afetadas: ${upd?.length ?? 0}`,
    );
    // limpar fatura criada na tentativa, se houver
    if (!error) {
      const { data: own } = await adminClient
        .from("invoices")
        .select("id")
        .eq("title", "tentativa proibida");
      for (const r of own ?? []) created.invoices.push(r.id);
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: somente admins
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const adminCheck = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: roleRow } = await adminCheck
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let results: TestResult[] = [];
  let runError: string | null = null;
  const adminSrv = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    results = await runSuite();
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err);
  } finally {
    try {
      await cleanup(adminSrv);
    } catch (_) { /* swallow cleanup errors */ }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return new Response(
    JSON.stringify({
      ok: !runError && failed === 0,
      error: runError,
      summary: { total: results.length, passed, failed },
      results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
