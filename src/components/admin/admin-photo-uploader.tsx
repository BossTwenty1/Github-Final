"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getAdminPhotos, getAdminRecords, getStorageStatus, updatePhotoReview, uploadBurialPhoto } from "@/lib/supabase/admin-data";
import type { AdminPhoto, AdminRecord } from "@/lib/supabase/types";

export function AdminPhotoUploader() {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [burialId, setBurialId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getStorageStatus(), getAdminRecords({ page: 0, pageSize: 100 }), getAdminPhotos()]).then(([status, nextRecords, nextPhotos]) => {
      setConfigured(status.configured);
      setRecords(nextRecords);
      setPhotos(nextPhotos.items);
    }).catch((reason: unknown) => {
      setConfigured(false);
      setError(reason instanceof Error ? reason.message : "Photo storage could not be checked.");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!burialId || !file) {
      setError("Select a burial record and choose an image.");
      return;
    }
    setBusy(true);
    try {
      await uploadBurialPhoto({ burialId: Number(burialId), file, caption, capturedAt });
      setFile(null);
      setCaption("");
      setCapturedAt("");
      setMessage("Photo uploaded for administrator review. It is private and not public yet.");
      const fileInput = document.getElementById("photo-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function review(photoId: number, approvalStatus: AdminPhoto["approvalStatus"]) {
    setError("");
    try {
      await updatePhotoReview(photoId, approvalStatus);
      setPhotos((current) => current.map((photo) => photo.photoId === photoId ? { ...photo, approvalStatus, publicDisplay: approvalStatus === "approved" } : photo));
      setMessage(approvalStatus === "approved" ? "Photo approved for public display." : approvalStatus === "rejected" ? "Photo rejected and kept private." : "Photo returned to pending review.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo review action could not be completed.");
    }
  }

  return <Card className="admin-form-card">
    <CardHeader><CardTitle>Upload cemetery photo</CardTitle></CardHeader>
    <CardContent>
      {configured === false ? <Alert icon="info" title="Photo storage is not configured" variant="warning">Configure the private Supabase Storage bucket for this environment before uploading. Photos remain optional.</Alert> : null}
      {configured ? <Alert icon="shield" title="Private review workflow" variant="info">Images are stored privately with pending approval and public display disabled. An administrator must review them before visitors can see them.</Alert> : null}
      {error ? <Alert icon="alert" title="Photo upload unavailable" variant="danger">{error}</Alert> : null}
      {message ? <Alert icon="check" title="Photo uploaded" variant="success">{message}</Alert> : null}
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label className="input-field" htmlFor="photo-burial"><span className="input-label">Burial record</span><select className="input-control" disabled={!records.length} id="photo-burial" onChange={(event) => setBurialId(event.target.value)} value={burialId}><option value="">{records.length ? "Select a burial record" : "No burial records loaded"}</option>{records.map((record) => <option key={record.burialId} value={record.burialId}>{record.name} — {record.plot}</option>)}</select></label>
        <Input accept="image/jpeg,image/png,image/webp" disabled={!configured} id="photo-file" label="Image file" onChange={(event) => setFile(event.target.files?.[0] || null)} type="file" hint="JPG, PNG, or WebP; maximum 10 MB." />
        <div className="filter-grid"><Input disabled={!configured} id="photo-caption" label="Caption (optional)" onChange={(event) => setCaption(event.target.value)} value={caption} /><Input disabled={!configured} id="photo-captured-at" label="Captured date (optional)" onChange={(event) => setCapturedAt(event.target.value)} type="date" value={capturedAt} /></div>
        <Button disabled={!configured || busy || !records.length} icon="upload" type="submit">{busy ? "Uploading…" : "Upload for review"}</Button>
      </form>
      <div className="admin-table-section"><h3 className="admin-card-title">Photo review queue</h3>{photos.length ? <Table caption="Photo review queue"><TableHead><TableRow><TableHeaderCell>File</TableHeaderCell><TableHeaderCell>Burial record</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Actions</TableHeaderCell></TableRow></TableHead><TableBody>{photos.map((photo) => <TableRow key={photo.photoId}><TableCell>{photo.fileName}<span className="table-secondary">{photo.caption || "No caption"}</span></TableCell><TableCell>{records.find((record) => record.burialId === photo.burialId)?.name || `Record #${photo.burialId}`}</TableCell><TableCell>{photo.approvalStatus}</TableCell><TableCell><div className="table-actions"><Button size="sm" variant="secondary" onClick={() => void review(photo.photoId, "approved")}>Approve</Button><Button size="sm" variant="danger" onClick={() => void review(photo.photoId, "rejected")}>Reject</Button></div></TableCell></TableRow>)}</TableBody></Table> : <p className="admin-card-muted">No uploaded photos are waiting for review.</p>}</div>
    </CardContent>
  </Card>;
}
