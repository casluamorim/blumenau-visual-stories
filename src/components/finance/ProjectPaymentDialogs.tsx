import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, CheckCircle2, PackageCheck } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Passo 1 — proposta aprovada: quando o pagamento está programado?
 */
export function PaymentScheduleDialog({
  open,
  onOpenChange,
  projectName,
  amount,
  onScheduled,
  onOnDelivery,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectName: string;
  amount: number;
  onScheduled: (date: string) => void | Promise<void>;
  onOnDelivery: () => void | Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setDate(''); setSaving(false); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Para quando está programado o pagamento deste projeto?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">{projectName}</p>
            <p className="text-muted-foreground">Valor da proposta: {fmt(amount)}</p>
          </div>

          <div>
            <Label>Data específica</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Button
            className="w-full"
            disabled={!date || saving}
            onClick={async () => { setSaving(true); await onScheduled(date); }}
          >
            <CalendarClock className="mr-2 h-4 w-4" /> Lançar em Contas a Receber
          </Button>

          <Button
            variant="outline"
            className="w-full"
            disabled={saving}
            onClick={async () => { setSaving(true); await onOnDelivery(); }}
          >
            <PackageCheck className="mr-2 h-4 w-4" /> Somente após a entrega do projeto
          </Button>

          <p className="text-xs text-muted-foreground">
            Se você fechar sem escolher, o projeto continua criado e fica um alerta pendente no
            dashboard lembrando de definir o pagamento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Passo 2 — tarefa concluída de projeto com pagamento "após a entrega".
 */
export function DeliveryPaymentDialog({
  open,
  onOpenChange,
  projectName,
  defaultAmount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectName: string;
  defaultAmount: number;
  onConfirm: (amount: number, date: string) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setAmount(String(defaultAmount || '')); setDate(''); setSaving(false); }
  }, [open, defaultAmount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Projeto {projectName} finalizado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Confirme os dados do pagamento:</p>
          <div>
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Pré-preenchido com o valor da proposta. Editar aqui não altera a proposta original.
            </p>
          </div>
          <div>
            <Label>Data prevista de pagamento *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!date || !Number(amount) || saving}
            onClick={async () => { setSaving(true); await onConfirm(Number(amount), date); }}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar e lançar no Financeiro PJ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
