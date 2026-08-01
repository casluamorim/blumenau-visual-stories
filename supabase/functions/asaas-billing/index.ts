// Integração Asaas: cria/sincroniza clientes e gera cobranças (PIX/boleto/cartão).
// Ações: sync_customer | create_charge | run_recurring | cancel_charge | refresh_charge

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const detail = parsed?.errors?.[0]?.description ?? text;
    throw new Error(`[Asaas ${res.status}] ${detail}`);
  }
  return parsed;
}

const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dueDateFor(day: number, ref = new Date()) {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const safe = Math.min(Math.max(day || 1, 1), last);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
}

type Admin = ReturnType<typeof createClient>;

async function ensureCustomer(admin: Admin, client: any) {
  if (client.asaas_customer_id) return client.asaas_customer_id as string;

  const cpfCnpj = onlyDigits(client.billing_cpf_cnpj ?? "");
  if (!cpfCnpj) throw new Error("Informe o CPF/CNPJ do cliente para cobrar via Asaas.");

  const payload: Record<string, unknown> = {
    name: client.company || client.name,
    cpfCnpj,
    email: client.email ?? undefined,
    mobilePhone: onlyDigits(client.phone ?? "") || undefined,
    externalReference: client.id,
    notificationDisabled: false,
  };

  // Reaproveita cliente já existente no Asaas pelo CPF/CNPJ
  const existing = await asaas(`/customers?cpfCnpj=${cpfCnpj}`);
  const found = existing?.data?.[0]?.id;
  const customerId = found ?? (await asaas("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  })).id;

  await admin.from("clients").update({ asaas_customer_id: customerId }).eq("id", client.id);
  return customerId as string;
}

async function createCharge(
  admin: Admin,
  client: any,
  opts: {
    amount: number;
    dueDate: string;
    description: string;
    billingType: string;
    isRecurring: boolean;
    competence?: string;
    createdBy?: string | null;
  },
) {
  const customerId = await ensureCustomer(admin, client);

  const payment = await asaas("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: opts.billingType || "PIX",
      value: Number(opts.amount.toFixed(2)),
      dueDate: opts.dueDate,
      description: opts.description,
      externalReference: client.id,
    }),
  });

  let pixPayload: string | null = null;
  let pixQr: string | null = null;
  if ((opts.billingType || "PIX") === "PIX") {
    try {
      const pix = await asaas(`/payments/${payment.id}/pixQrCode`);
      pixPayload = pix?.payload ?? null;
      pixQr = pix?.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null;
    } catch (_) { /* PIX QR opcional */ }
  }

  // Fatura correspondente no financeiro (PJ)
  const { data: invoice } = await admin.from("invoices").insert({
    client_id: client.id,
    title: opts.description,
    amount: opts.amount,
    due_date: opts.dueDate,
    status: "pending",
    payment_method: (opts.billingType || "PIX") === "PIX" ? "pix" : "boleto",
    financial_type: "pj",
    notes: "Cobrança gerada automaticamente via Asaas",
    created_by: opts.createdBy ?? null,
  }).select("id").maybeSingle();

  const { data: charge, error } = await admin.from("asaas_charges").insert({
    client_id: client.id,
    invoice_id: invoice?.id ?? null,
    asaas_payment_id: payment.id,
    description: opts.description,
    amount: opts.amount,
    billing_type: opts.billingType || "PIX",
    status: payment.status ?? "PENDING",
    due_date: opts.dueDate,
    invoice_url: payment.invoiceUrl ?? null,
    pix_payload: pixPayload,
    pix_qr_code: pixQr,
    competence_month: opts.competence ?? monthKey(new Date(`${opts.dueDate}T00:00:00Z`)),
    is_recurring: opts.isRecurring,
    created_by: opts.createdBy ?? null,
  }).select("*").maybeSingle();

  if (error) throw new Error(error.message);
  return charge;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("method not allowed", 405);
  if (!ASAAS_API_KEY) return bad("ASAAS_API_KEY não configurada", 500);

  let body: any;
  try { body = await req.json(); } catch { return bad("invalid json"); }
  const action = String(body?.action ?? "");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // run_recurring pode ser chamado pelo cron (service role) ou por um admin logado
  const authHeader = req.headers.get("Authorization") ?? "";
  const CRON_KEY = Deno.env.get("ASAAS_CRON_KEY") ?? "";
  const cronKey = req.headers.get("x-cron-key") ?? "";
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY) ||
    (!!CRON_KEY && cronKey === CRON_KEY);
  let userId: string | null = null;

  if (!isServiceRole) {
    if (!authHeader) return bad("missing auth", 401);
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return bad("invalid token", 401);
    userId = userData.user.id;

    const { data: roles } = await admin.from("user_roles")
      .select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) =>
      ["admin", "manager", "financeiro"].includes(r.role)
    );
    if (!allowed) return bad("sem permissão para cobranças", 403);
  }

  try {
    if (action === "sync_customer") {
      const { data: client } = await admin.from("clients").select("*")
        .eq("id", body.client_id).maybeSingle();
      if (!client) return bad("cliente não encontrado", 404);
      const id = await ensureCustomer(admin, client);
      return json({ ok: true, asaas_customer_id: id });
    }

    if (action === "create_charge") {
      const { data: client } = await admin.from("clients").select("*")
        .eq("id", body.client_id).maybeSingle();
      if (!client) return bad("cliente não encontrado", 404);

      const amount = Number(body.amount);
      if (!amount || amount <= 0) return bad("valor inválido");
      const dueDate = String(body.due_date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return bad("vencimento inválido");

      const charge = await createCharge(admin, client, {
        amount,
        dueDate,
        description: String(body.description ?? `Serviços — ${client.company || client.name}`).slice(0, 300),
        billingType: String(body.billing_type ?? client.billing_type ?? "PIX"),
        isRecurring: false,
        createdBy: userId,
      });
      return json({ ok: true, charge });
    }

    if (action === "run_recurring") {
      const today = new Date();
      const mk = monthKey(today);
      const { data: clients } = await admin.from("clients")
        .select("*")
        .eq("billing_enabled", true);

      const results: any[] = [];
      for (const client of clients ?? []) {
        try {
          if (!client.billing_amount || !client.billing_due_day) continue;
          if (client.billing_last_generated_month === mk) continue;

          const dueDate = dueDateFor(Number(client.billing_due_day), today);
          const charge = await createCharge(admin, client, {
            amount: Number(client.billing_amount),
            dueDate,
            description: client.billing_description ||
              `Mensalidade ${mk} — ${client.company || client.name}`,
            billingType: client.billing_type ?? "PIX",
            isRecurring: true,
            competence: mk,
            createdBy: userId,
          });
          await admin.from("clients")
            .update({ billing_last_generated_month: mk })
            .eq("id", client.id);
          results.push({ client_id: client.id, charge_id: charge?.id, ok: true });
        } catch (e) {
          results.push({ client_id: client.id, ok: false, error: String(e) });
        }
      }
      return json({ ok: true, month: mk, results });
    }

    if (action === "refresh_charge") {
      const { data: charge } = await admin.from("asaas_charges").select("*")
        .eq("id", body.charge_id).maybeSingle();
      if (!charge) return bad("cobrança não encontrada", 404);
      const payment = await asaas(`/payments/${charge.asaas_payment_id}`);
      await admin.from("asaas_charges").update({
        status: payment.status,
        invoice_url: payment.invoiceUrl ?? charge.invoice_url,
        paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : charge.paid_at,
      }).eq("id", charge.id);
      return json({ ok: true, status: payment.status });
    }

    if (action === "cancel_charge") {
      const { data: charge } = await admin.from("asaas_charges").select("*")
        .eq("id", body.charge_id).maybeSingle();
      if (!charge) return bad("cobrança não encontrada", 404);
      await asaas(`/payments/${charge.asaas_payment_id}`, { method: "DELETE" });
      await admin.from("asaas_charges").update({ status: "CANCELLED" }).eq("id", charge.id);
      if (charge.invoice_id) {
        await admin.from("invoices").update({ status: "cancelled" }).eq("id", charge.invoice_id);
      }
      return json({ ok: true });
    }

    return bad("ação inválida");
  } catch (e) {
    console.error("asaas-billing error:", e);
    return bad(String((e as Error).message ?? e), 500);
  }
});
