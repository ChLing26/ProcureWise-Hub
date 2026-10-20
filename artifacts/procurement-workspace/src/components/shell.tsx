import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, FileStack, Stamp, Receipt, Sparkles, Menu, X, Info, RotateCw } from "lucide-react";
import { useListProcurementRequests } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/requests", label: "Requests", icon: FileStack },
  { href: "/approvals", label: "Approvals", icon: Stamp },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/recommendations", label: "Insights", icon: Sparkles },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const { data } = useListProcurementRequests();
  const pending = data?.filter((r) => r.status === "pending_approval").length ?? 0;
  const isActive = (h: string) => (h === "/" ? loc === "/" : loc.startsWith(h));

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`}
          className={cn("group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive(href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")}>
          {isActive(href) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary" />}
          <Icon className="h-4 w-4 transition-transform group-hover:-translate-y-px" />
          <span className="flex-1">{label}</span>
          {href === "/approvals" && pending > 0 && <span className="num rounded bg-sidebar-primary px-1.5 text-[11px] text-sidebar-primary-foreground">{pending}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="paper-grain min-h-[100dvh] md:flex">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-[100dvh] md:translate-x-0 flex",
        open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-2.5 px-6 pt-6 pb-8">
          <div className="grid h-7 w-7 place-items-center rounded bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">P</div>
          <div>
            <div className="font-bold tracking-tight leading-none">ProcureFlow</div>
            <div className="num text-[10px] uppercase tracking-widest text-sidebar-foreground/50 mt-1">buying ledger</div>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setOpen(false)} data-testid="button-close-nav"><X className="h-4 w-4" /></button>
        </div>
        {nav}
        <div className="mt-auto m-3 rounded-md border border-sidebar-border p-3 text-[11px] leading-relaxed text-sidebar-foreground/60">
          <div className="flex items-center gap-1.5 font-semibold text-sidebar-foreground/90 mb-1"><Info className="h-3 w-3" /> Demo prototype</div>
          Supplier quotes are illustrative. Manager identity is self-entered. Invoices are internal records, not tax-authority validated and not sent externally.
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1 min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 backdrop-blur px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} data-testid="button-open-nav"><Menu className="h-5 w-5" /></button>
          <span className="font-bold">ProcureFlow</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <div className="num text-[11px] uppercase tracking-[0.2em] text-accent mb-2">{kicker}</div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ onRetry, msg = "Could not load this data." }: { onRetry: () => void; msg?: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 flex items-center justify-between gap-4" data-testid="status-error">
      <span className="text-sm">{msg}</span>
      <button onClick={onRetry} data-testid="button-retry" className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm hover:bg-card"><RotateCw className="h-3.5 w-3.5" /> Retry</button>
    </div>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="ruled rounded-md border border-dashed p-10 text-center" data-testid="status-empty">
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{body}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Rows({ n = 5 }: { n?: number }) {
  return <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

export const STATUS: Record<string, { label: string; cls: string }> = {
  open_for_quotes: { label: "Open for quotes", cls: "bg-secondary text-secondary-foreground" },
  pending_approval: { label: "Pending approval", cls: "bg-accent/15 text-accent border-accent/30" },
  approved: { label: "Approved", cls: "bg-primary/10 text-primary border-primary/30" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function StatusTag({ s }: { s: string }) {
  const m = STATUS[s] ?? { label: s, cls: "bg-muted" };
  return <span className={cn("inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", m.cls)} data-testid={`status-${s}`}>{m.label}</span>;
}

export const money = (n: number, c = "MYR") => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n); }
  catch { return `${n.toFixed(2)} ${c}`; }
};
export const fdate = (d: string) => { const x = new Date(d); return isNaN(+x) ? d : x.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); };
