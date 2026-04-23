#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Script local: invoca a edge function `qa-rls-tests` autenticado como admin
 * e imprime o relatório no terminal.
 *
 * Uso:
 *   deno run --allow-net --allow-env --allow-read scripts/run-rls-tests.ts
 *
 * Variáveis de ambiente esperadas (no .env do projeto ou exportadas):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   QA_ADMIN_EMAIL      (e-mail de um usuário admin existente)
 *   QA_ADMIN_PASSWORD   (senha desse admin)
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const ADMIN_EMAIL = Deno.env.get("QA_ADMIN_EMAIL");
const ADMIN_PASSWORD = Deno.env.get("QA_ADMIN_PASSWORD");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios");
  Deno.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("❌ Defina QA_ADMIN_EMAIL e QA_ADMIN_PASSWORD (admin existente)");
  Deno.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { error: signErr } = await client.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (signErr) {
  console.error("❌ Falha no login:", signErr.message);
  Deno.exit(1);
}

console.log("▶ Executando suite de testes RLS...\n");
const { data, error } = await client.functions.invoke("qa-rls-tests", { body: {} });
if (error) {
  console.error("❌ Erro ao invocar função:", error.message);
  Deno.exit(1);
}

const { ok, summary, results, error: runError } = data as {
  ok: boolean;
  error: string | null;
  summary: { total: number; passed: number; failed: number };
  results: { name: string; passed: boolean; detail?: string }[];
};

for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}

console.log(
  `\n${ok ? "✅" : "❌"} ${summary.passed}/${summary.total} passaram` +
  (summary.failed ? ` • ${summary.failed} falha(s)` : ""),
);
if (runError) console.log(`   erro: ${runError}`);

await client.auth.signOut();
Deno.exit(ok ? 0 : 1);
