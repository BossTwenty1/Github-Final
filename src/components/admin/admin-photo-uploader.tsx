"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getAdminPhotos, getAdminPhotoPreview, getStorageStatus, searchStaffBurials, updatePhotoReview, uploadBurialPhoto, type StaffBurialOption } from "@/lib/supabase/admin-data";
import { useStaff } from "./staff-context";
import type { AdminPhoto } from "@/lib/supabase/types";

export function AdminPhotoUploader() {
  const canAdmin = useStaff()?.role === "ADMIN";
  const [records, setRecords] = useState<StaffBurialOption[]>([]);
  const [recordQuery, setRecordQuery] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordLoading, setRecordLoading] = useState(true);
  const [selected, setSelected] = useState<StaffBurialOption | null>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [photoPage, setPhotoPage] = useState(0);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [status, setStatus] = useState<AdminPhoto["approvalStatus"] | "all">("pending");
  const [photoLoading, setPhotoLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState<{ id: number; url: string; name: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewRequest = useRef(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const submission = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getStorageStatus().then((value) => { if (active) setConfigured(value.configured); }).catch(() => { if (active) setError("Photo storage could not be checked. Reload to try again."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      searchStaffBurials(recordQuery, recordPage).then((result) => {
        if (active) { setRecords(result.items); setRecordTotal(result.total); }
      }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); })
        .finally(() => { if (active) setRecordLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [recordQuery, recordPage]);
  useEffect(() => {
    let active = true;
    getAdminPhotos({ page: photoPage, pageSize: 20, status }).then((result) => {
      if (active) { setPhotos(result.items); setPhotoTotal(result.total || 0); }
    }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [photoPage, status, refresh]);

  function reloadQueue() { setPhotoLoading(true); setRefresh((value) => value + 1); }
  function changeRecordPage(page: number) { setRecordLoading(true); setRecordPage(page); }
  function changePhotoPage(page: number) { setPhotoLoading(true); setPhotoPage(page); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || !selected || !file) return;
    submission.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await uploadBurialPhoto({ burialId: selected.burial_id, file, caption, capturedAt });
      setFile(null); setCaption(""); setCapturedAt("");
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Photo uploaded for administrator review. It remains private until approved.");
      setStatus("pending"); setPhotoPage(0); reloadQueue();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { submission.current = false; setBusy(false); }
  }
  async function review(photo: AdminPhoto, approvalStatus: AdminPhoto["approvalStatus"]) {
    if (submission.current || !canAdmin) return;
    submission.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await updatePhotoReview(photo.photoId, approvalStatus, photo.revision);
      setMessage(approvalStatus === "approved" ? "Photo approved for public display." : "Photo rejected and kept private.");
      setPreview(null); previewRequest.current += 1;
      if (photos.length === 1 && photoPage > 0 && status !== "all") setPhotoPage((value) => value - 1);
      reloadQueue();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { submission.current = false; setBusy(false); }
  }
  async function showPreview(photo: AdminPhoto) {
    const request = ++previewRequest.current;
    setPreviewBusy(true); setPreview(null); setError("");
    try {
      const url = await getAdminPhotoPreview(photo.photoId);
      if (request === previewRequest.current) setPreview({ id: photo.photoId, url, name: photo.fileName });
    } catch (reason) { if (request === previewRequest.current) setError(errorMessage(reason)); }
    finally { if (request === previewRequest.current) setPreviewBusy(false); }
  }

  return <Card className="admin-form-card">
    <CardHeader><CardTitle>Upload cemetery photo</CardTitle></CardHeader>
    <CardContent>
      {configured === false ? <Alert title="Photo storage is not configured" variant="warning">Configure the private photo bucket before uploading.</Alert> : null}
      {error ? <Alert title="Photo action unavailable" variant="danger">{error}</Alert> : null}
      {message ? <div role="status"><Alert title="Photo update" variant="success">{message}</Alert></div> : null}
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <Input id="photo-record-search" label="Find a burial record" value={recordQuery} maxLength={160} placeholder="Name or plot code" onChange={(event) => { setRecordQuery(event.target.value); setRecordPage(1); setRecordLoading(true); }} />
        <div aria-busy={recordLoading}>
          <label className="input-field" htmlFor="photo-burial"><span className="input-label">Matching records</span><select className="input-control" disabled={recordLoading || busy} id="photo-burial" value={selected ? String(selected.burial_id) : ""} onChange={(event) => setSelected(records.find((record) => String(record.burial_id) === event.target.value) || null)}>
            <option value="">{recordLoading ? "Searching…" : records.length ? "Select a burial record" : "No matching records"}</option>
            {selected && !records.some((record) => record.burial_id === selected.burial_id) ? <option value={selected.burial_id}>{selected.display_name} — {selected.lot_code} (selected)</option> : null}
            {records.map((record) => <option key={record.burial_id} value={record.burial_id}>{record.display_name} — {record.area_name} · {record.lot_code}</option>)}
          </select></label>
          <div className="map-pagination"><Button type="button" variant="secondary" disabled={recordLoading || recordPage <= 1} onClick={() => changeRecordPage(recordPage - 1)}>Previous</Button><span>{recordTotal} records · page {recordPage}</span><Button type="button" variant="secondary" disabled={recordLoading || recordPage * 20 >= recordTotal} onClick={() => changeRecordPage(recordPage + 1)}>Next</Button></div>
        </div>
        {selected ? <p>Uploading for <strong>{selected.display_name}</strong> · {selected.area_name} · {selected.lot_code}</p> : null}
        <Input ref={fileInput} accept="image/jpeg,image/png,image/webp" disabled={!configured || busy} id="photo-file" label="Image file" onChange={(event) => setFile(event.target.files?.[0] || null)} type="file" hint="JPG, PNG, or WebP; maximum 10 MB. Uploads remain private pending review." />
        <div className="filter-grid"><Input disabled={busy} id="photo-caption" label="Caption (optional)" maxLength={2000} onChange={(event) => setCaption(event.target.value)} value={caption} /><Input disabled={busy} id="photo-captured-at" label="Captured date (optional)" onChange={(event) => setCapturedAt(event.target.value)} type="date" value={capturedAt} /></div>
        <Button disabled={!configured || busy || !selected || !file} icon="upload" type="submit">{busy ? "Saving…" : "Upload for review"}</Button>
      </form>
      <div className="admin-table-section">
        <h3 className="admin-card-title">Photo review queue</h3>
        <div className="results-controls"><label className="input-field"><span className="input-label">Review status</span><select className="input-control" value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value as typeof status); setPhotoPage(0); setPhotoLoading(true); }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All photos</option></select></label><Button variant="secondary" disabled={busy || photoLoading} onClick={reloadQueue}>Refresh queue</Button></div>
        {previewBusy ? <p role="status">Loading private preview…</p> : null}
        {preview ? <div className="photo-review-preview"><Image src={preview.url} alt={`Review image: ${preview.name}`} width={800} height={600} unoptimized onError={() => setError("The preview expired or could not be loaded. Select Preview again.")} /><Button variant="secondary" onClick={() => { previewRequest.current += 1; setPreview(null); }}>Close preview</Button></div> : null}
        {photoLoading ? <p role="status">Loading photos…</p> : photos.length ? <Table caption="Photo review queue"><TableHead><TableRow><TableHeaderCell>File</TableHeaderCell><TableHeaderCell>Burial record</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Actions</TableHeaderCell></TableRow></TableHead><TableBody>{photos.map((photo) => <TableRow key={photo.photoId}><TableCell>{photo.fileName}<span className="table-secondary">{photo.caption || "No caption"}</span></TableCell><TableCell>Record #{photo.burialId}</TableCell><TableCell>{photo.approvalStatus}</TableCell><TableCell><div className="table-actions"><Button size="sm" variant="secondary" disabled={previewBusy} onClick={() => void showPreview(photo)}>Preview</Button><Button size="sm" variant="secondary" disabled={busy || !canAdmin || photo.approvalStatus === "approved"} onClick={() => void review(photo, "approved")}>Approve</Button><Button size="sm" variant="danger" disabled={busy || !canAdmin || photo.approvalStatus === "rejected"} onClick={() => void review(photo, "rejected")}>Reject</Button></div></TableCell></TableRow>)}</TableBody></Table> : <p>No photos match this status.</p>}
        <div className="map-pagination"><Button variant="secondary" disabled={photoLoading || busy || photoPage === 0} onClick={() => changePhotoPage(photoPage - 1)}>Previous photos</Button><span>{photoTotal} photos · page {photoPage + 1}</span><Button variant="secondary" disabled={photoLoading || busy || (photoPage + 1) * 20 >= photoTotal} onClick={() => changePhotoPage(photoPage + 1)}>Next photos</Button></div>
      </div>
    </CardContent>
  </Card>;
}
function errorMessage(reason: unknown) { return reason && typeof reason === "object" && "message" in reason ? String(reason.message) : "The action could not be completed. Try again."; }
