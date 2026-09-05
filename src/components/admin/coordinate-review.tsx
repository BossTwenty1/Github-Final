"use client";
import { useEffect, useState } from "react";
import { getLotsForVerificationPage, updateLotVerification, type LotRow } from "@/lib/supabase/admin-data";
import { AdminPageFrame } from "./admin-page-content";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export function CoordinateReview({ selectedPlot = "" }: { selectedPlot?: string }) {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  async function load(nextPage = 0) {
    const result = await getLotsForVerificationPage({ page: nextPage });
    setLots((current) => nextPage ? [...current, ...result.items] : result.items);
    setPage(nextPage); setHasMore(result.hasMore);
  }
  useEffect(() => { let active = true; void getLotsForVerificationPage().then((result) => { if (active) { setLots(result.items); setHasMore(result.hasMore); } }).catch((reason) => { if (active) setError(reason.message || "Could not load coordinates."); }); return () => { active = false; }; }, []);
  async function review(lot: LotRow, status: "verified" | "rejected") {
    if (busy) return;
    const reason = (reasons[lot.lot_id] || "").trim();
    if (status === "rejected" && !reason) { setError("Enter a rejection reason for " + lot.lot_code + "."); return; }
    setBusy(true); setError(""); setMessage("");
    try { await updateLotVerification(lot.lot_id, lot.revision, status, reason); await load(); setMessage(lot.lot_code + " " + status + "."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  return <AdminPageFrame title="Coordinate Verification" description="Administrator review of recorded coordinates. Rejections require a reason.">
    {selectedPlot ? <p>Selected plot: {selectedPlot}</p> : null}
    {error ? <Alert variant="danger" title="Review not saved">{error} <Button disabled={busy} variant="quiet" onClick={() => void load().catch(() => setError("Reload failed. Try again."))}>Reload queue</Button></Alert> : null}
    {message ? <Alert title="Review saved" variant="success">{message}</Alert> : null}
    {!lots.length ? <p>No plots loaded.</p> : null}
    {lots.map((lot) => <Card key={lot.lot_id}><CardContent>
      <h2>{lot.lot_code}</h2><p>{lot.location ? lot.location.latitude + ", " + lot.location.longitude : "No GPS coordinate recorded"} · {lot.coordinate_status}</p>
      {lot.coordinate_rejection_reason ? <p>Previous rejection: {lot.coordinate_rejection_reason}</p> : null}
      <Input label={"Rejection reason for " + lot.lot_code} maxLength={2000} value={reasons[lot.lot_id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [lot.lot_id]: event.target.value }))} />
      <div className="table-actions"><Button disabled={busy || !lot.location} onClick={() => void review(lot, "verified")}>Verify</Button><Button disabled={busy || !lot.location} variant="danger" onClick={() => void review(lot, "rejected")}>Reject</Button></div>
    </CardContent></Card>)}
    {hasMore ? <Button disabled={busy} onClick={async () => { setBusy(true); try { await load(page + 1); } catch { setError("Could not load more plots."); } finally { setBusy(false); } }}>Load more</Button> : null}
  </AdminPageFrame>;
}
