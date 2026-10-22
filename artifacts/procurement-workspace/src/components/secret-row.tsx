import { useEffect, useState } from "react";
import { Copy, Check, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import type { SecretMetadata } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fdate } from "@/components/shell";

const MASK = "••••••••••••";

export function SecretRow({ s, writable, onReplace, onDelete }: { s: SecretMetadata; writable: boolean; onReplace: () => void; onDelete: () => void }) {
  const [copy, setCopy] = useState<"idle" | "ok" | "err">("idle");
  useEffect(() => { if (copy === "idle") return; const t = window.setTimeout(() => setCopy("idle"), 2200); return () => window.clearTimeout(t); }, [copy]);
  const copyName = async () => {
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(s.name); setCopy("ok"); }
    catch { setCopy("err"); }
  };
  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-secondary/40 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]" data-testid={`row-secret-${s.name}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="num truncate text-sm font-medium" data-testid={`text-secret-name-${s.name}`}>{s.name}</span>
          <button type="button" onClick={() => void copyName()} aria-label={`Copy name ${s.name}`} data-testid={`button-copy-name-${s.name}`}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100">
            {copy === "ok" ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          </button>
          <span role="status" aria-live="polite" className={copy === "err" ? "text-[11px] text-destructive" : "sr-only"}>
            {copy === "ok" ? "Name copied" : copy === "err" ? "Couldn't copy" : ""}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span className={s.configured ? "inline-flex items-center gap-1 text-primary" : ""} data-testid={`status-secret-${s.name}`}>
            <span className={s.configured ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"} aria-hidden />
            {s.configured ? "Configured" : "Not configured"}
          </span>
          <span aria-hidden>·</span><span>Updated {fdate(s.updatedAt)}</span>
        </div>
      </div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
        <span className="num select-none tracking-[0.18em] text-muted-foreground" aria-label="Value hidden, write-only" data-testid={`text-secret-mask-${s.name}`}>{MASK}</span>
      </div>
      <div className="col-start-2 row-start-1 sm:col-start-3 justify-self-end">
        {writable ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Actions for ${s.name}`} data-testid={`button-menu-${s.name}`}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted">
              <MoreVertical className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onReplace} data-testid={`button-replace-${s.name}`}><RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />Replace value</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive" data-testid={`button-delete-${s.name}`}><Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : <span className="block h-8 w-8" aria-hidden />}
      </div>
    </li>
  );
}
