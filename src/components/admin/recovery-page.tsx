"use client";
import { useEffect, useState } from "react";
import { getRecordHistory, saveStaffRecord, type RecordHistory } from "@/lib/supabase/admin-data";
import { AdminPageFrame } from "./admin-page-content";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
export function RecoveryPage() {
  const [rows, setRows] = useState<RecordHistory[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<RecordHistory | null>(null);
  async function load(nextPage = 0) { const next = await getRecordHistory(nextPage); setRows((current) => nextPage ? [...current, ...next] : next); setHasMore(next.length === 25); setPage(nextPage); }
  useEffect(() => { let active = true; void getRecordHistory().then((next) => { if (active) { setRows(next); setHasMore(next.length === 25); } }).catch((reason) => { if (active) setError(reason.message); }); return () => { active = false; }; }, []);
  async function recover() {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await saveStaffRecord(selected.entity, selected.record_id, selected.after_revision,
        selected.operation === "delete" ? {} : { history_id: selected.history_id }, selected.operation === "delete" ? "restore" : "revert");
      setSelected(null); await load(); setMessage("Recovery saved and recorded in the audit history.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Recovery failed."); }
    finally { setBusy(false); }
  }
  return <AdminPageFrame title="Recovery" description="Administrators can restore removed records or undo the latest unchanged edit. Review the saved values before confirming.">
    {error ? <Alert title="Recovery not saved" variant="danger">{error}</Alert> : null}
    {message ? <Alert title="Recovered" variant="success">{message}</Alert> : null}
    {!rows.length ? <p>No recoverable changes have been recorded yet.</p> : null}
    {rows.map((row) => <Card key={row.history_id}><CardContent><h2>{row.entity} #{row.record_id}</h2><p>{row.operation} · {new Date(row.created_at).toLocaleString()}</p>
      <details><summary>Review previous values</summary><pre className="audit-values">{JSON.stringify(row.before_values, null, 2)}</pre></details>
      <Button disabled={busy || row.operation === "restore"} onClick={() => setSelected(row)} variant="secondary">{row.operation === "delete" ? "Restore removed record" : "Undo this change"}</Button>
    </CardContent></Card>)}
    {hasMore ? <Button disabled={busy} onClick={async () => { setBusy(true); try { await load(page + 1); } catch { setError("Could not load history."); } finally { setBusy(false); } }}>Load more history</Button> : null}
    <ConfirmationDialog open={Boolean(selected)} title="Apply this recovery?" description={<p>The record must still be at the version shown. Restoring a public burial makes it visible again. Recovered coordinate changes require verification.</p>} confirmLabel={busy ? "Recovering…" : "Apply recovery"} onConfirm={() => void recover()} onClose={() => { if (!busy) setSelected(null); }} />
  </AdminPageFrame>;
}
