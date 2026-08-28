"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { getAdminRecords, getAuditLog, getLotsForVerification } from "@/lib/supabase/admin-data";
import type { AdminRecord, AuditLogEntry } from "@/lib/supabase/types";

export function AdminFoundation() {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [lots, setLots] = useState<Array<{ lot_id: number; lot_code: string; coordinate_verified: boolean; coordinate_status: string }>>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminRecords(), getLotsForVerification(), getAuditLog()]).then(([nextRecords, nextLots, nextAudit]) => {
      setRecords(nextRecords);
      setLots(nextLots);
      setAudit(nextAudit);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The operational data could not be loaded.")).finally(() => setLoading(false));
  }, []);

  const active = records.filter((record) => record.recordStatus === "active").length;
  const pending = records.filter((record) => record.recordStatus === "pending").length;
  const archived = records.filter((record) => record.recordStatus === "archived").length;
  const unverified = lots.filter((lot) => !lot.coordinate_verified).length;

  return <div className="admin-foundation"><PageHeading actions={<><Link href="/admin/coordinate-verification"><Button icon="target" variant="secondary">Verify coordinates</Button></Link><Link href="/admin/reports"><Button icon="chart" variant="secondary">Generate report</Button></Link><Link href="/admin/burial-records?add=1"><Button icon="plus">Add burial record</Button></Link></>} description="Overview of cemetery operations and Supabase-backed records." eyebrow="Administrator workspace" title="Dashboard" />{error ? <Alert icon="alert" title="Supabase data connection unavailable" variant="danger">{error}</Alert> : null}{loading ? <Card><CardContent><p className="admin-card-muted">Loading operational data…</p></CardContent></Card> : <><div className="metrics-grid"><MetricCard href="/admin/burial-records" icon="records" label="Active records" value={active} trend={`${pending} pending · ${archived} archived`} /><MetricCard href="/admin/plot-management" icon="grid" label="Known plots" value={lots.length} trend="Loaded from Supabase" /><MetricCard href="/admin/coordinate-verification" icon="verification" label="Unverified locations" value={unverified} trend={unverified ? "Review queue" : "No locations awaiting review"} danger={unverified > 0} /><MetricCard href="/admin/audit-log" icon="audit" label="Recent audit events" value={audit.length} trend="Latest 100 events" /></div><div className="dashboard-grid"><Card><CardHeader><CardTitle>Record status</CardTitle><Badge variant="info">Connected data</Badge></CardHeader><CardContent className="bar-list"><Bar label="Active" value={active} total={Math.max(records.length, 1)} color="bar-fill--green" /><Bar label="Pending" value={pending} total={Math.max(records.length, 1)} color="bar-fill--light-green" /><Bar label="Archived" value={archived} total={Math.max(records.length, 1)} color="bar-fill--slate" /></CardContent></Card><Card><CardHeader><CardTitle>Recent audit events</CardTitle><Link className="text-button" href="/admin/audit-log">View all</Link></CardHeader>{audit.length ? <div className="change-list">{audit.slice(0, 4).map((entry) => <ChangeItem entry={entry} key={entry.audit_id} />)}</div> : <CardContent><EmptyState description="No application changes have been recorded in this environment yet." icon="audit" title="No audit events" /></CardContent>}</Card></div></>}</div>;
}

function MetricCard({ href, icon, label, value, trend, danger = false }: { href: string; icon: "records" | "grid" | "verification" | "audit"; label: string; value: number; trend: string; danger?: boolean }) {
  return <Link className="metric-card-link" href={href}><Card className="metric-card"><div className="metric-card__top"><span className={`metric-icon ${danger ? "metric-icon--danger" : ""}`}><Icon name={icon} size={21} /></span><span>{label}</span></div><p className="metric-value">{value.toLocaleString()}</p><p className={`metric-trend ${danger ? "metric-trend--danger" : "metric-trend--muted"}`}>{trend}</p></Card></Link>;
}
function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { return <div className="bar-row"><span>{label}</span><span className="bar-track"><span className={`bar-fill ${color}`} style={{ width: `${Math.round((value / total) * 100)}%` }} /></span><strong>{value.toLocaleString()}</strong></div>; }
function ChangeItem({ entry }: { entry: AuditLogEntry }) { return <div className="change-item"><span className="change-item__icon"><Icon name={entry.action === "verify" ? "verification" : entry.action === "export" ? "download" : "records"} size={16} /></span><div><p>{entry.action} · {entry.table_name}</p><span>Record {entry.record_id}</span></div><time>{new Date(entry.created_at).toLocaleString()}</time></div>; }
