import { Link } from "wouter";
import { ArrowUpRight, Plus } from "lucide-react";
import { useGetProcurementDashboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead, ErrorBox, Empty, money } from "@/components/shell";

export default function Dashboard() {
  const q = useGetProcurementDashboard();
  const d = q.data;
  const stats = d ? [
    { k: "Active requests", v: String(d.activeRequests), id: "active" },
    { k: "Awaiting approval", v: String(d.awaitingApproval), id: "awaiting", hot: d.awaitingApproval > 0 },
    { k: "Approved this month", v: String(d.approvedThisMonth), id: "approved" },
    { k: "Saved against budget · MYR", v: money(d.savingsAgainstBudget), id: "savings" },
  ] : [];
  return (
    <>
      <PageHead kicker="Overview" title="Buying activity">
        <Link href="/requests?new=1" data-testid="link-new-request" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-0"><Plus className="h-4 w-4" /> New requirement</Link>
      </PageHead>
      {q.isError ? <ErrorBox onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 border rounded-md bg-card divide-x divide-y lg:divide-y-0 overflow-hidden">
            {q.isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-5"><Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-8 w-16" /></div>) :
              stats.map((s, i) => (
                <div key={s.id} className="rise p-5" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">{s.hot && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}{s.k}</div>
                  <div className="num text-2xl md:text-3xl font-semibold mt-2" data-testid={`text-stat-${s.id}`}>{s.v}</div>
                </div>
              ))}
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_260px]">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent activity</h2>
              {q.isLoading ? <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div> :
                !d?.recentActivity.length ? <Empty title="No activity recorded yet" body="Create a requirement to start the trail of quotes, decisions and invoices." /> :
                <ol className="relative border-l ml-2">
                  {d.recentActivity.map((a, i) => (
                    <li key={a.id} className="rise pl-5 pb-5 relative" style={{ animationDelay: `${i * 40}ms` }} data-testid={`row-activity-${a.id}`}>
                      <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${a.kind.includes("reject") ? "bg-destructive" : a.kind.includes("approv") ? "bg-primary" : "bg-accent"}`} />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{a.title}</span>
                        <span className="num text-[11px] text-muted-foreground">{new Date(a.time).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.detail}</p>
                    </li>
                  ))}
                </ol>}
            </section>
            <aside className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jump to</h2>
              {[["/approvals", "Review pending decisions"], ["/invoices", "Open invoice records"], ["/recommendations", "See supplier insights"]].map(([h, l]) => (
                <Link key={h} href={h} className="group flex items-center justify-between rounded-md border bg-card px-4 py-3 text-sm hover:border-primary/40 transition-colors" data-testid={`link-jump-${h.slice(1)}`}>
                  {l}<ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
