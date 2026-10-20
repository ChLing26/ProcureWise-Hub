import { useState } from "react";
import { Link } from "wouter";
import { Printer, ShieldAlert } from "lucide-react";
import { useListProcurementInvoices, type ProcurementInvoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PageHead, ErrorBox, Empty, Rows, money, fdate } from "@/components/shell";
import { cn } from "@/lib/utils";

function Sheet({ inv }: { inv: ProcurementInvoice }) {
  const sub = inv.unitPrice * inv.quantity;
  return (
    <article className="rounded-md border bg-card p-6 md:p-8" data-testid={`invoice-${inv.id}`}>
      <div className="flex flex-wrap justify-between gap-4 border-b pb-4">
        <div><div className="num text-[11px] uppercase tracking-[0.2em] text-accent">Internal invoice record</div><div className="num text-2xl font-semibold mt-1">{inv.reference}</div></div>
        <div className="num text-sm text-right"><div>Issued {fdate(inv.issuedAt)}</div><div className="text-muted-foreground">Request <Link href={`/requests/${inv.requestId}`} className="underline">#{String(inv.requestId).padStart(4, "0")}</Link></div></div>
      </div>
      <div className="grid grid-cols-2 gap-4 py-4 text-sm border-b">
        <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Buyer</div><div className="font-medium">{inv.buyerName}</div></div>
        <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Supplier</div><div className="font-medium">{inv.supplierName}</div></div>
      </div>
      <table className="w-full text-sm my-4 num">
        <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left"><th className="font-normal py-1">Item</th><th className="font-normal text-right">Qty</th><th className="font-normal text-right">Unit</th><th className="font-normal text-right">Line</th></tr></thead>
        <tbody>
          <tr className="border-t"><td className="py-2 font-sans">{inv.itemName}</td><td className="text-right">{inv.quantity}</td><td className="text-right">{money(inv.unitPrice, inv.currency)}</td><td className="text-right">{money(sub, inv.currency)}</td></tr>
          <tr className="border-t"><td className="py-2 font-sans" colSpan={3}>Shipping</td><td className="text-right">{money(inv.shippingFee, inv.currency)}</td></tr>
          <tr className="border-t-2 border-foreground"><td className="py-2 font-sans font-semibold" colSpan={3}>Total</td><td className="text-right font-semibold text-base" data-testid={`text-total-${inv.id}`}>{money(inv.totalAmount, inv.currency)}</td></tr>
        </tbody>
      </table>
      <div className="rounded bg-muted/60 p-3 text-xs">
        <div className="text-muted-foreground mb-1">{inv.signatureType} · integrity hash, not a certified legal signature</div>
        <code className="num break-all">{inv.signature}</code>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Internal record only. Not validated by any tax authority and not delivered to the supplier.</p>
    </article>
  );
}

export default function Invoices() {
  const q = useListProcurementInvoices();
  const [sel, setSel] = useState<number | null>(null);
  const list = q.data ?? [];
  const cur = list.find((i) => i.id === sel) ?? list[0];
  return (
    <>
      <div className="no-print"><PageHead kicker="Records" title="Invoices">
        <Button variant="outline" disabled={!cur} onClick={() => window.print()} data-testid="button-print"><Printer className="h-4 w-4 mr-1" />Print</Button>
      </PageHead>
        <div className="flex gap-2 items-start rounded-md border border-accent/30 bg-accent/5 p-3 text-xs mb-6"><ShieldAlert className="h-4 w-4 text-accent shrink-0" />Generated automatically on approval. These are internal buyer and supplier records for this demo, not tax documents.</div>
      </div>
      {q.isLoading ? <Rows /> : q.isError ? <ErrorBox onRetry={() => q.refetch()} /> :
        !list.length ? <Empty title="No invoices yet" body="Approve a supplier offer and its invoice record will appear here."><Link href="/approvals" className="text-primary underline text-sm">Go to approvals</Link></Empty> :
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="no-print rounded-md border bg-card divide-y self-start overflow-hidden">
            {list.map((i) => (
              <li key={i.id}><button onClick={() => setSel(i.id)} data-testid={`button-invoice-${i.id}`}
                className={cn("w-full text-left px-4 py-3 transition-colors hover:bg-muted/50", cur?.id === i.id && "bg-primary/5 border-l-2 border-primary")}>
                <div className="num text-sm font-medium">{i.reference}</div>
                <div className="flex justify-between text-xs text-muted-foreground"><span className="truncate">{i.supplierName}</span><span className="num">{money(i.totalAmount, i.currency)}</span></div>
              </button></li>
            ))}
          </ul>
          {cur && <Sheet inv={cur} />}
        </div>}
    </>
  );
}
