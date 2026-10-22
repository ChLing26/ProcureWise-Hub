import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import {
  ApiError, useSignProcurementInvoice, getListProcurementInvoicesQueryKey,
  getGetProcurementRequestQueryKey, type ProcurementInvoice,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function InvoiceSignatureRecord({ inv }: { inv: ProcurementInvoice }) {
  const signature = inv.electronicSignature;
  if (!signature) return <p className="mt-5 rounded-md border border-dashed p-4 text-sm text-muted-foreground">Not electronically signed yet.</p>;
  return (
    <section className="mt-5 rounded-md border border-primary/20 bg-primary/5 p-4" aria-label="Electronic signature" data-testid="invoice-saved-signature">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary"><CheckCircle2 className="h-4 w-4" />Electronically signed</div>
      <div className="my-3 break-words font-serif text-2xl italic" data-testid="text-signature-name">{signature.typedName}</div>
      <p className="text-xs leading-relaxed">Signed through account: <strong className="break-words">{signature.accountName}</strong> · #{signature.accountId}</p>
      <p className="mt-1 text-xs text-muted-foreground">{new Date(signature.signedAt).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
      <p className="mt-2 text-[11px] text-muted-foreground">Typed-name consent · {signature.consentVersion}. Account identity does not verify manager authority. Not a certified digital signature.</p>
      <div className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
        Signed document integrity hash
        <code className="num mt-1 block break-all">{signature.documentHash}</code>
      </div>
    </section>
  );
}

export function InvoiceSignatureForm({ inv, onBusyChange, disabled = false }: { inv: ProcurementInvoice; onBusyChange: (busy: boolean) => void; disabled?: boolean }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const mutation = useSignProcurementInvoice();
  const client = useQueryClient();
  if (inv.electronicSignature) return saved ? <p role="status" className="no-print mt-3 text-sm text-primary">Electronic signature saved.</p> : null;

  async function sign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || disabled) return;
    setError(null);
    if (name.trim().length < 2 || name.trim().length > 120 || !consent) {
      setError("Enter your name and confirm your consent before signing."); return;
    }
    onBusyChange(true);
    try {
      const signed = await mutation.mutateAsync({ invoiceId: inv.id, data: { typedName: name.trim(), consent: true } });
      client.setQueryData<ProcurementInvoice[]>(getListProcurementInvoicesQueryKey(), (old) =>
        old?.map((entry) => entry.id === signed.id ? signed : entry));
      setSaved(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: getListProcurementInvoicesQueryKey() }),
        client.invalidateQueries({ queryKey: getGetProcurementRequestQueryKey(inv.requestId) }),
      ]);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409
        ? "Another account has already signed this invoice. Refreshing its signature."
        : "The signature could not be saved. Check your connection and try again.");
      if (cause instanceof ApiError && cause.status === 409) {
        await client.invalidateQueries({ queryKey: getListProcurementInvoicesQueryKey() });
      }
    } finally {
      onBusyChange(false);
    }
  }
  return (
    <section className="no-print mt-5 rounded-md border bg-card p-5" aria-labelledby="sign-invoice-heading">
      <h2 id="sign-invoice-heading" className="flex items-center gap-2 text-sm font-semibold"><PenLine className="h-4 w-4" />Add e-signature</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Signing as account {user?.name}. This saves a permanent internal consent record, not a supplier countersignature or certified legal signature.</p>
      <form onSubmit={sign} className="mt-4 space-y-3">
        <div>
          <label htmlFor="invoice-signature-name" className="mb-1.5 block text-xs font-medium">Your full name</label>
          <input id="invoice-signature-name" data-testid="input-signature-name" autoComplete="name" required minLength={2} maxLength={120}
            value={name} onChange={(event) => setName(event.target.value)} disabled={mutation.isPending || disabled}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        {name.trim() && <div className="rounded-md bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signature preview</p><p className="mt-1 break-words font-serif text-2xl italic">{name.trim()}</p></div>}
        <label className="flex items-start gap-2 text-xs leading-relaxed">
          <input type="checkbox" data-testid="checkbox-signature-consent" checked={consent} required disabled={mutation.isPending || disabled}
            onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
          I intend my typed name to be my electronic signature on this invoice. I understand it will be saved with my account and signing time, and cannot be replaced.
        </label>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={disabled || mutation.isPending || !consent || name.trim().length < 2} data-testid="button-sign-invoice">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
          {mutation.isPending ? "Saving signature…" : "Sign invoice"}
        </Button>
      </form>
    </section>
  );
}
