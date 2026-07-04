import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Upload, TrendingDown, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onImported: () => void;
  financialType?: 'pj' | 'pf';
}

interface ParsedRow {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number;
  category: string;
  selected: boolean;
}

export const CC_CATEGORIES = [
  'Cartão de Crédito',
  'Alimentação', 'Mercado', 'Restaurante', 'Delivery',
  'Transporte', 'Gasolina', 'Estacionamento', 'Pedágio', 'Manutenção Veículo',
  'Viagem', 'Hospedagem', 'Passagem Aérea',
  'Assinaturas', 'Software/SaaS', 'Telefonia/Internet',
  'Marketing', 'Publicidade Online',
  'Escritório', 'Papelaria',
  'Impostos', 'Taxas Bancárias', 'Juros',
  'Serviços', 'Manutenção Casa', 'Aluguel', 'Condomínio', 'Água', 'Luz', 'Gás',
  'Educação', 'Livros',
  'Saúde', 'Farmácia', 'Academia',
  'Lazer', 'Streaming', 'Presentes', 'Vestuário',
  'Pets', 'Filhos', 'Doações',
  'Outros',
];
const CATEGORIES = CC_CATEGORIES;

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/posto|combust|gasolin|shell|ipiranga|petrobras|ale sat|br mania/i, 'Gasolina'],
  [/estacion|zona azul|estapar|multipark/i, 'Estacionamento'],
  [/pedagio|pedágio|ecovias|autoban|ccr|conectcar|sem parar/i, 'Pedágio'],
  [/oficina|mecanic|autopeca|pneu|borracharia/i, 'Manutenção Veículo'],
  [/uber|99app|99 |taxi|cabify|metro|onibus|blablacar/i, 'Transporte'],
  [/hotel|airbnb|booking|pousada|resort|hostel/i, 'Hospedagem'],
  [/latam|gol|azul|smiles|decolar|123 ?milhas|kiwi\.com|avianca/i, 'Passagem Aérea'],
  [/ifood|rappi|zé delivery|ze delivery|james delivery/i, 'Delivery'],
  [/restaurante|lanchon|padaria|pizzar|churrasc|hamburg|bar |pub /i, 'Restaurante'],
  [/mercado|super|hortifr|atacad|carrefour|assai|pao de acucar|extra |sams club/i, 'Mercado'],
  [/farmac|drogaria|drogasil|pacheco|raia|panvel/i, 'Farmácia'],
  [/hospital|clinica|consulta|laborat|exame|dentist|psicolog/i, 'Saúde'],
  [/academia|gympass|smartfit|crossfit|pilates/i, 'Academia'],
  [/netflix|spotify|prime video|hbo|disney|globoplay|deezer|paramount|youtube premium/i, 'Streaming'],
  [/apple\.com\/bill|google.*(one|storage|play)|icloud|dropbox/i, 'Assinaturas'],
  [/openai|chatgpt|anthropic|figma|notion|canva|adobe|github|vercel|cloudflare|aws|google cloud|lovable|supabase|linear|slack/i, 'Software/SaaS'],
  [/meta ads|facebook ads|instagram ads|google ads|tiktok ads|linkedin ads/i, 'Publicidade Online'],
  [/vivo|claro|tim|oi |nextel|net |algar|sky|internet/i, 'Telefonia/Internet'],
  [/papelaria|kalunga/i, 'Papelaria'],
  [/das |simples nacional|receita|imposto|inss|iss|darf/i, 'Impostos'],
  [/tarifa|anuidade|juros|iof/i, 'Taxas Bancárias'],
  [/aluguel|imobili/i, 'Aluguel'],
  [/condomin/i, 'Condomínio'],
  [/sabesp|copasa|cedae|agua |água/i, 'Água'],
  [/enel|eletropaulo|light|cemig|copel|energisa|celpe|equatorial/i, 'Luz'],
  [/comgas|gás|gas natural/i, 'Gás'],
  [/curso|udemy|hotmart|alura|coursera|edx|escola/i, 'Educação'],
  [/livro|amazon.*livr|estante virtual|saraiva/i, 'Livros'],
  [/cinema|ingresso|show|teatro|parque|kinoplex|cinemark/i, 'Lazer'],
  [/petz|cobasi|petshop|veterin/i, 'Pets'],
  [/renner|c&a|riachuelo|zara|nike|adidas|centauro|dafiti|shein/i, 'Vestuário'],
  [/presente|gift/i, 'Presentes'],
];


const LEARNED_KEY = 'cc-import-category-map-v1';

function descKey(desc: string): string {
  return desc.toLowerCase().replace(/\s+—\s+.*$/, '').replace(/\s{2,}/g, ' ').trim();
}

function loadLearned(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}'); } catch { return {}; }
}

function saveLearned(map: Record<string, string>) {
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify(map)); } catch {}
}

function suggestCategory(desc: string, learned?: Record<string, string>): string {
  const l = learned ?? loadLearned();
  const k = descKey(desc);
  if (l[k]) return l[k];
  for (const [rx, cat] of KEYWORD_MAP) if (rx.test(desc)) return cat;
  return 'Outros';
}

function normalizeAmount(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().replace(/["R$\s]/g, '');
  const neg = /^-/.test(s) || /\(.*\)/.test(s);
  s = s.replace(/[()-]/g, '');
  // Brazilian format 1.234,56 vs US 1,234.56
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  // yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yr}-${m[2]}-${m[1]}`;
  }
  return '';
}

function parseCsv(text: string): string[][] {
  // Split lines and detect delimiter
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const semi = (lines[0].match(/;/g) || []).length;
  const comma = (lines[0].match(/,/g) || []).length;
  const delim = semi >= comma ? ';' : ',';

  const rows: string[][] = [];
  for (const line of lines) {
    const out: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === delim && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
}

export function CreditCardImport({ onImported, financialType = 'pj' }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [cardTitle, setCardTitle] = useState('');
  const [cardDueDate, setCardDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [importedSummary, setImportedSummary] = useState<Record<string, number> | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  function reset() {
    setRows([]); setFileName(''); setImportedSummary(null); setCardTitle('');
  }

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const csv = parseCsv(text);
      if (!csv.length) { toast({ title: 'CSV vazio', variant: 'destructive' }); return; }

      // Find the header row anywhere in the file (Sicredi/Nubank/Itaú etc. can have preamble lines)
      let headerRowIdx = -1;
      let dateIdx = -1, descIdx = -1, amountIdx = -1;
      for (let i = 0; i < Math.min(csv.length, 60); i++) {
        const h = csv[i].map(c => (c ?? '').toLowerCase().trim());
        const d = h.findIndex(c => /^data($|\b)|date/.test(c));
        const de = h.findIndex(c => /desc|estabelec|hist|lançam|lancam|memo|titulo|title/.test(c));
        const a = h.findIndex(c => /^valor($|\s*\(r\$\))|amount|montante|^value$/.test(c));
        if (d >= 0 && a >= 0) {
          headerRowIdx = i; dateIdx = d; descIdx = de; amountIdx = a;
          break;
        }
      }

      let body: string[][];
      let di: number, de: number, ai: number, nameIdx = -1;
      if (headerRowIdx >= 0) {
        body = csv.slice(headerRowIdx + 1);
        di = dateIdx; de = descIdx >= 0 ? descIdx : 1; ai = amountIdx;
        const h = csv[headerRowIdx].map(c => (c ?? '').toLowerCase().trim());
        nameIdx = h.findIndex(c => /^nome$|portador|titular|cardholder/.test(c));
      } else {
        // Fallback: assume first row is header with date,desc,amount
        body = csv.slice(1);
        di = 0; de = 1; ai = 2;
      }

      const learned = loadLearned();
      const parsed: ParsedRow[] = [];
      for (const r of body) {
        if (!r || r.every(c => !c || !String(c).trim())) continue;
        const rawDate = r[di] ?? '';
        const rawDesc = (r[de] ?? '').trim();
        const rawAmt = r[ai] ?? '';
        const date = normalizeDate(rawDate);
        const amt = normalizeAmount(rawAmt);
        if (!date || !rawDesc || !Number.isFinite(amt)) continue;
        // Skip payments/credits (negative on Sicredi = pagamento/estorno)
        if (amt < 0) continue;
        if (amt === 0) continue;
        // Skip obvious non-purchase rows
        if (/pagamento|pag fat|credito taxa|cr[ée]dito/i.test(rawDesc)) continue;
        let desc = rawDesc.replace(/\s{2,}/g, ' ');
        const holder = nameIdx >= 0 ? (r[nameIdx] ?? '').trim() : '';
        if (holder) desc = `${desc} — ${holder}`;
        parsed.push({
          date, description: desc, amount: Math.abs(amt),
          category: suggestCategory(desc, learned), selected: true,
        });
      }
      if (!parsed.length) {
        toast({ title: 'Não foi possível ler o CSV', description: 'Verifique se contém colunas de Data, Descrição e Valor.', variant: 'destructive' });
        return;
      }
      setRows(parsed);
      setImportedSummary(null);
      toast({ title: `${parsed.length} lançamento(s) detectado(s)` });
    };
    reader.readAsText(f, 'utf-8');
  }


  const selectedTotals = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    for (const r of rows) if (r.selected) {
      map[r.category] = (map[r.category] ?? 0) + r.amount;
      total += r.amount;
    }
    return { map, total };
  }, [rows]);

  async function importAll() {
    const toInsert = rows.filter(r => r.selected);
    if (!toInsert.length) { toast({ title: 'Selecione ao menos um lançamento' }); return; }
    const title = cardTitle.trim() || (fileName ? `Cartão — ${fileName.replace(/\.[^.]+$/, '')}` : 'Cartão de Crédito');
    if (!cardDueDate) { toast({ title: 'Informe o vencimento da fatura', variant: 'destructive' }); return; }
    setImporting(true);
    const total = toInsert.reduce((a, r) => a + r.amount, 0);
    // 1) Create parent card expense
    const { data: parent, error: pErr } = await (supabase.from('expenses') as any).insert({
      description: title,
      amount: total,
      category: 'Cartão de Crédito',
      due_date: cardDueDate,
      status: 'pending',
      financial_type: financialType,
      recurrence: 'one_time',
      notes: `[Fatura de Cartão]${fileName ? ` Importado de ${fileName}` : ''} • ${toInsert.length} itens`,
      created_by: user?.id,
    }).select('id').single();
    if (pErr || !parent) {
      setImporting(false);
      toast({ title: 'Erro ao criar fatura', description: pErr?.message, variant: 'destructive' });
      return;
    }
    // 2) Insert children linked to parent
    const payload = toInsert.map(r => ({
      description: r.description,
      amount: r.amount,
      category: r.category,
      due_date: r.date,
      status: 'paid' as any,
      financial_type: financialType as any,
      recurrence: 'one_time' as any,
      parent_expense_id: parent.id,
      notes: `[Item de fatura]`,
      created_by: user?.id,
    }));
    const { error } = await supabase.from('expenses').insert(payload as any);
    setImporting(false);
    if (error) { toast({ title: 'Erro ao importar itens', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Fatura criada com ${toInsert.length} item(ns)!` });
    setImportedSummary(selectedTotals.map);
    setRows([]);
    onImported();
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const summaryList = importedSummary
    ? Object.entries(importedSummary).sort((a, b) => b[1] - a[1])
    : Object.entries(selectedTotals.map).sort((a, b) => b[1] - a[1]);
  const summaryTotal = summaryList.reduce((a, [, v]) => a + v, 0);

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CreditCard className="mr-2 h-4 w-4" /> Importar Cartão (CSV)
      </Button>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Importar Fatura de Cartão
          </DialogTitle>
        </DialogHeader>

        {!rows.length && !importedSummary && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Envie o CSV da sua fatura. Aceita colunas <b>Data, Descrição/Estabelecimento, Valor</b> (Nubank, Itaú, Bradesco, etc.).
              </p>
              <Input
                type="file" accept=".csv,text/csv"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileName(f.name);
                    if (!cardTitle) setCardTitle(`Cartão — ${f.name.replace(/\.[^.]+$/, '')}`);
                    handleFile(f);
                  }
                }}
                className="max-w-xs mx-auto"
              />
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border p-3 bg-muted/20">
              <div>
                <Label className="text-xs">Título da fatura</Label>
                <Input value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="Ex: Nubank Dez/2025" />
              </div>
              <div>
                <Label className="text-xs">Vencimento da fatura</Label>
                <Input type="date" value={cardDueDate} onChange={e => setCardDueDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Arquivo: <span className="text-foreground">{fileName}</span> • {rows.filter(r => r.selected).length}/{rows.length} itens • Total: <span className="text-foreground font-semibold">{fmt(selectedTotals.total)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRows(rs => rs.map(r => ({ ...r, selected: true })))}>Marcar todos</Button>
                <Button variant="ghost" size="sm" onClick={() => setRows(rs => rs.map(r => ({ ...r, selected: false })))}>Desmarcar</Button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-52">Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox checked={r.selected} onCheckedChange={v => setRows(rs => rs.map((x, j) => j === i ? { ...x, selected: !!v } : x))} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(r.date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-sm">{r.description}</TableCell>
                      <TableCell>
                        <Select value={r.category} onValueChange={v => {
                          const key = descKey(r.description);
                          const learned = loadLearned();
                          learned[key] = v;
                          saveLearned(learned);
                          setRows(rs => rs.map(x => descKey(x.description) === key ? { ...x, category: v } : x));
                        }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">{fmt(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {summaryList.length > 0 && (
              <div className="rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Prévia — Maiores gastos por categoria</h4>
                </div>
                <CategoryBars items={summaryList} total={summaryTotal} fmt={fmt} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
              <Button onClick={importAll} disabled={importing}>
                {importing ? 'Criando fatura...' : `Criar fatura com ${rows.filter(r => r.selected).length} item(ns)`}
              </Button>
            </div>
          </div>
        )}

        {importedSummary && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              ✅ Despesas importadas com sucesso.
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <h4 className="font-semibold">Análise — Maiores gastos por categoria</h4>
                <Badge variant="outline" className="ml-auto">Total: {fmt(summaryTotal)}</Badge>
              </div>
              <CategoryBars items={summaryList} total={summaryTotal} fmt={fmt} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setOpen(false); reset(); }}>Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryBars({ items, total, fmt }: { items: [string, number][]; total: number; fmt: (n: number) => string }) {
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {items.map(([cat, val]) => {
        const pct = (val / total) * 100;
        return (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{cat}</span>
              <span className="text-muted-foreground">{fmt(val)} • {pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${(val / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
