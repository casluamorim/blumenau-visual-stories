// Webhook do Asaas: atualiza status da cobrança, marca a fatura como paga
// e cria notificação no dashboard da equipe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, asaas-access-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

const PAID = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (WEBHOOK_TOKEN) {
    const token = req.headers.get("asaas-access-token") ?? "";
    if (token !== WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = String(body?.event ?? "");
  const payment = body?.payment;
  if (!payment?.id) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: charge } = await admin.from("asaas_charges")
    .select("*").eq("asaas_payment_id", payment.id).maybeSingle();

  if (!charge) {
    return new Response(JSON.stringify({ ok: true, unknown_payment: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isPaid = PAID.includes(event);
  const paidAt = isPaid
    ? new Date(payment.paymentDate ?? payment.clientPaymentDate ?? Date.now()).toISOString()
    : null;

  await admin.from("asaas_charges").update({
    status: payment.status ?? charge.status,
    invoice_url: payment.invoiceUrl ?? charge.invoice_url,
    paid_at: paidAt ?? charge.paid_at,
  }).eq("id", charge.id);

  if (charge.invoice_id) {
    if (isPaid) {
      await admin.from("invoices").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: charge.billing_type === "PIX" ? "pix" : "boleto",
      }).eq("id", charge.invoice_id);
    } else if (event === "PAYMENT_OVERDUE") {
      await admin.from("invoices").update({ status: "overdue" }).eq("id", charge.invoice_id);
    } else if (event === "PAYMENT_DELETED") {
      await admin.from("invoices").update({ status: "cancelled" }).eq("id", charge.invoice_id);
    }
  }

  if (isPaid || event === "PAYMENT_OVERDUE") {
    const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(Number(charge.amount));
    await admin.from("client_notifications").insert({
      client_id: charge.client_id,
      kind: isPaid ? "payment_received" : "payment_overdue",
      title: isPaid ? `Pagamento recebido — ${brl}` : `Cobrança vencida — ${brl}`,
      message: charge.description ?? null,
      author_name: "Asaas",
    });
  }

  await admin.from("activity_logs").insert({
    action: `asaas.${event.toLowerCase()}`,
    entity_type: "asaas_charge",
    entity_id: charge.id,
    details: { payment_id: payment.id, status: payment.status },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
