import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Lock, ShieldCheck, Loader2, CheckCircle2, Wrench, Search, X } from "lucide-react";
import {
  ApiError, useGetToolsCapabilities, getGetToolsCapabilitiesQueryKey, useListToolsSecrets, getListToolsSecretsQueryKey,
  createToolsSecret, replaceToolsSecret, deleteToolsSecret, type SecretMetadata,
} from "@workspace/api-client-react";
import { ErrorBox, Empty, Rows } from "@/components/shell";
import { SecretRow } from "@/components/secret-row";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const KEY_MAX = 4096;
const keyError = (value: string) => !value.trim() ? "Enter a nonblank key value."
  : new TextEncoder().encode(value).length > KEY_MAX ? "Keys can be up to 4096 UTF-8 bytes." : undefined;

type Kind = "create" | "replace" | "delete";
function safeMessage(err: unknown, kind: Kind): string {
  const status = err instanceof ApiError ? err.status : 0;
  switch (status) {
    case 400: case 422: return "Check the name and key, then try again.";
    case 401: return "Your session ended. Sign in again to continue.";
    case 403: return "Only workspace owners and admins can change stored secrets.";
    case 404: return "That secret no longer exists. The list has been refreshed.";
    case 409: return kind === "create" ? "A secret with this name already exists. Use Replace on that row instead." : "This secret changed elsewhere. Refresh and try again.";
    case 413: return "The key is too long. Keys can be up to 4096 UTF-8 bytes.";
    case 429: return "Too many attempts. Wait a moment and try again.";
    case 503: return "Secret storage is not set up yet. A trusted operator must finish server configuration.";
    default: return status >= 500 ? "The server could not complete this request. Try again shortly." : "Something went wrong. Check your connection and try again.";
  }
}

function KeyField({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">Key value</label>
      <input id={id} type="password" autoComplete="new-password" spellCheck={false} autoCapitalize="off" autoCorrect="off"
        maxLength={KEY_MAX} value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-hint`}
        data-testid={`input-${id}`} className="w-full border border-input px-3 py-2.5 text-sm outline-none" />
      <p id={`${id}-hint`} className={error ? "mt-1.5 text-xs text-destructive" : "mt-1.5 text-xs text-muted-foreground"}>
        {error ?? "Stored encrypted on the server. It is never shown again after saving."}
      </p>
    </div>
  );
}

export default function Tools() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const caps = useGetToolsCapabilities({ query: { queryKey: getGetToolsCapabilitiesQueryKey() } });
  const list = useListToolsSecrets({ query: { queryKey: getListToolsSecretsQueryKey() } });
  const canManage = !!caps.data?.canManageSecrets;
  const setupRequired = !!caps.data?.setupRequired;
  const writable = canManage && !setupRequired;

  const [mode, setMode] = useState<null | "create" | "replace-form" | "replace-confirm" | "delete">(null);
  const [target, setTarget] = useState<string>("");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [fieldErr, setFieldErr] = useState<{ name?: string; key?: string }>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingKey = useRef("");

  const reset = () => { setMode(null); setName(""); setKey(""); pendingKey.current = ""; setFieldErr({}); setFormErr(null); };
  const resetRef = useRef(reset); resetRef.current = reset;
  // Clear transient input on capability loss and account change.
  useEffect(() => { if (!writable) resetRef.current(); }, [writable]);
  useEffect(() => () => { pendingKey.current = ""; }, []);
  useEffect(() => { resetRef.current(); setNotice(null); }, [user?.id]);
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(null), 6000); return () => window.clearTimeout(t); }, [notice]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: getListToolsSecretsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetToolsCapabilitiesQueryKey() }); };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    const k = key;
    setKey("");
    const n = name.trim(); const errs: typeof fieldErr = {};
    if (!NAME_RE.test(n)) errs.name = "Start with A–Z, then use A–Z, 0–9 or underscore. Up to 64 characters.";
    else if (list.data?.some(s => s.name === n)) errs.name = "A secret with this name already exists. Use Replace on that row instead.";
    errs.key = keyError(k);
    setFieldErr(errs); setFormErr(null);
    if (errs.name || errs.key) return;
    setBusy(true);
    try { await createToolsSecret({ name: n, key: k }); reset(); setNotice(`${n} saved. Its value is now hidden.`); }
    catch (err) { const m = safeMessage(err, "create"); if (err instanceof ApiError && err.status === 409) setFieldErr({ name: m }); else setFormErr(m); }
    finally { setBusy(false); refresh(); }
  };

  const continueReplace = (e: FormEvent) => {
    e.preventDefault();
    const k = key;
    setKey("");
    const error = keyError(k);
    if (error) return setFieldErr({ key: error });
    pendingKey.current = k; setFieldErr({}); setMode("replace-confirm");
  };
  const confirmReplace = async () => {
    const k = pendingKey.current; pendingKey.current = ""; setBusy(true); setFormErr(null);
    try { await replaceToolsSecret(target, { key: k }); reset(); setNotice(`${target} replaced. The previous value is gone.`); }
    catch (err) { reset(); setNotice(null); setFormErr(safeMessage(err, "replace")); }
    finally { setBusy(false); refresh(); }
  };
  const confirmDelete = async () => {
    setBusy(true); setFormErr(null);
    try { await deleteToolsSecret(target); reset(); setNotice(`${target} deleted.`); }
    catch (err) { reset(); setFormErr(safeMessage(err, "delete")); }
    finally { setBusy(false); refresh(); }
  };

  const loading = caps.isLoading || list.isLoading;
  const secrets: SecretMetadata[] = list.data ?? [];
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? secrets.filter(s => s.name.toLowerCase().includes(q)) : secrets;
  const disabledReason = !canManage ? "Only workspace owners and admins can add secrets." : setupRequired ? "Secret storage needs server setup before keys can be saved." : "";
  const openCreate = () => { reset(); setMode("create"); };

  return (
    <div>
      <div className="rise mb-6 border-b pb-4">
        <div className="num text-[11px] uppercase tracking-[0.2em] text-accent">Tools</div>
      </div>
      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Application tools" className="rise">
          <div id="tools-nav-label" className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Application tools</div>
          <ul aria-labelledby="tools-nav-label" className="flex gap-1 md:flex-col">
            <li><span aria-current="page" data-testid="link-tools-secrets" className="relative flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground">
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary" aria-hidden /><KeyRound className="h-4 w-4" aria-hidden />Secrets</span></li>
          </ul>
        </nav>

        <section aria-labelledby="secrets-title" className="min-w-0">
          <div className="rise mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 id="secrets-title" className="text-2xl font-extrabold tracking-tight md:text-3xl">Secrets</h1>
            <div className="flex flex-col items-end gap-1">
              <button type="button" onClick={openCreate} disabled={!writable || loading} aria-describedby={!writable && !loading ? "new-secret-reason" : undefined} data-testid="button-new-secret"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"><Plus className="h-4 w-4" aria-hidden />New Secret</button>
              {!writable && !loading && !caps.isError && <span id="new-secret-reason" className="text-[11px] text-muted-foreground" data-testid="text-new-secret-reason">{disabledReason}</span>}
            </div>
          </div>

          <div aria-live="polite">
            {notice && <div role="status" className="rise mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm" data-testid="status-success"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />{notice}</div>}
            {formErr && !mode && <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive" data-testid="error-action">{formErr}</div>}
          </div>

          <div className="relative mb-3">
            <label htmlFor="secret-filter" className="sr-only">Filter secrets by name</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input id="secret-filter" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by name" autoComplete="off" spellCheck={false}
              onKeyDown={e => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
              data-testid="input-filter-secrets" className="w-full border border-input py-2.5 pl-9 pr-9 text-sm outline-none" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" data-testid="button-clear-filter"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" aria-hidden /></button>}
          </div>

          {loading ? <div role="status" aria-label="Loading secrets"><Rows n={4} /></div>
            : caps.isError ? <ErrorBox msg="Could not check your access to Tools." onRetry={() => void caps.refetch()} />
            : list.isError ? <ErrorBox msg="Could not load stored secrets." onRetry={() => void list.refetch()} />
            : secrets.length === 0 ? (
              <Empty title="No secrets stored yet" body={writable ? "Add a named key for tools to use later." : "When an admin adds a key, its name will appear here."}>
                {writable && <button type="button" onClick={openCreate} data-testid="button-new-secret-empty" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" aria-hidden />New Secret</button>}
              </Empty>
            ) : shown.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center" data-testid="status-no-results">
                <div className="text-sm font-semibold">No secrets match "<span className="num">{query.trim()}</span>"</div>
                <button type="button" onClick={() => setQuery("")} className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted" data-testid="button-clear-filter-empty">Clear filter</button>
              </div>
            ) : (
              <div className="rise overflow-hidden rounded-md border bg-card">
                <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-x-3 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                  <span>Name</span><span>Value</span><span className="w-8" />
                </div>
                <ul className="divide-y" aria-label="Stored secrets">
                  {shown.map(s => <SecretRow key={s.name} s={s} writable={writable}
                    onReplace={() => { reset(); setTarget(s.name); setMode("replace-form"); }}
                    onDelete={() => { reset(); setTarget(s.name); setMode("delete"); }} />)}
                </ul>
                <div className="border-t px-4 py-2 text-[11px] text-muted-foreground" data-testid="text-secret-count">{q ? `${shown.length} of ${secrets.length}` : secrets.length} {secrets.length === 1 ? "secret" : "secrets"}</div>
              </div>
            )}

          <div className="mt-6 space-y-2 text-xs leading-relaxed">
            {!loading && setupRequired && (
              <div className="flex gap-2.5 rounded-md border border-accent/30 bg-accent/10 px-3.5 py-2.5" data-testid="status-setup-required">
                <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                <p><strong className="font-semibold">Server setup required.</strong> A trusted operator must configure secret storage on the server. Nothing can be configured here.</p>
              </div>
            )}
            {!loading && !caps.isError && !canManage && (
              <div className="flex gap-2.5 rounded-md border bg-muted/60 px-3.5 py-2.5 text-muted-foreground" data-testid="status-read-only">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <p>Read-only: you can see names. Only owners and admins can add, replace or delete.</p>
              </div>
            )}
            <div className="flex gap-2.5 rounded-md border bg-secondary/50 px-3.5 py-2.5 text-secondary-foreground" data-testid="text-storage-note">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>Values are write-only: stored encrypted and never shown, copied or sent back to the browser. Saving a key doesn't switch on any integration or change Replit Secrets.</p>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={mode === "create"} onOpenChange={o => { if (!o && !busy) reset(); }}>
        <DialogContent>
          <form onSubmit={submitCreate} noValidate className="space-y-4">
            <DialogHeader><DialogTitle>New secret</DialogTitle><DialogDescription>The value is sent once and stays hidden afterwards.</DialogDescription></DialogHeader>
            <div>
              <label htmlFor="secret-name" className="mb-1.5 block text-sm font-semibold">Name</label>
              <input id="secret-name" value={name} onChange={e => setName(e.target.value.toUpperCase())} maxLength={64} autoComplete="off" spellCheck={false}
                placeholder="GEMINI_API_KEY" aria-invalid={!!fieldErr.name} aria-describedby="secret-name-hint" data-testid="input-secret-name" className="num w-full border border-input px-3 py-2.5 text-sm outline-none" />
              <p id="secret-name-hint" className={fieldErr.name ? "mt-1.5 text-xs text-destructive" : "mt-1.5 text-xs text-muted-foreground"}>{fieldErr.name ?? "Uppercase letters, digits and underscores, starting with a letter."}</p>
            </div>
            <KeyField id="secret-key" value={key} onChange={setKey} error={fieldErr.key} />
            {formErr && <p role="alert" className="text-sm text-destructive" data-testid="error-create">{formErr}</p>}
            <DialogFooter>
              <button type="button" onClick={reset} disabled={busy} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" data-testid="button-cancel-create">Cancel</button>
              <button type="submit" disabled={busy} aria-busy={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="button-save-secret">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save secret</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "replace-form"} onOpenChange={o => { if (!o) reset(); }}>
        <DialogContent>
          <form onSubmit={continueReplace} noValidate className="space-y-4">
            <DialogHeader><DialogTitle>Replace <span className="num">{target}</span></DialogTitle><DialogDescription>The current value will be overwritten and cannot be recovered.</DialogDescription></DialogHeader>
            <KeyField id="replace-key" value={key} onChange={setKey} error={fieldErr.key} />
            <DialogFooter>
              <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" data-testid="button-cancel-replace">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" data-testid="button-continue-replace">Continue</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={mode === "replace-confirm" || mode === "delete"} onOpenChange={o => { if (!o && !busy) reset(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === "delete" ? "Delete" : "Replace"} <span className="num">{target}</span>?</AlertDialogTitle>
            <AlertDialogDescription>{mode === "delete" ? "The stored value will be removed permanently. Tools relying on it will stop finding a key." : "The previous value will be overwritten permanently."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void (mode === "delete" ? confirmDelete() : confirmReplace()); }}
              className={mode === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined} data-testid="button-confirm-action">
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}{mode === "delete" ? "Delete secret" : "Replace value"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
