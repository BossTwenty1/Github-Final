"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-heading";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { adminBurialRecords, adminPlotOccupancy, adminRecentChanges, adminReportSummaries, adminSections, adminVerificationIssues, getAdminRecord, getAdminVerificationIssue } from "@/lib/admin-mock-data";
import type { AdminBurialRecord } from "@/lib/admin-mock-data";
import type { IconName } from "@/components/ui/icons";

type NewBurialRecord = Pick<AdminBurialRecord, "name" | "plot" | "section" | "year" | "status">;

export function AdminBurialRecordsPage({ showAdd = false, selectedRecordId = "" }: { showAdd?: boolean; selectedRecordId?: string }) {
  const [addOpen, setAddOpen] = useState(showAdd);
  const [records, setRecords] = useState(adminBurialRecords);
  const selectedRecord = getAdminRecord(selectedRecordId);

  function addRecord(record: NewBurialRecord) {
    setRecords((current) => [{ ...record, id: `BN-${1000 + current.length + 1}`, updated: "Just now" }, ...current]);
  }

  return <AdminPageFrame title="Burial Records" description="Review and organize placeholder burial records." actions={<Button icon="plus" onClick={() => setAddOpen(true)}>Add burial record</Button>}><div className="admin-summary-grid"><SummaryCard icon="records" label="Visible records" value={records.length} /><SummaryCard icon="check" label="Verified" value={records.filter((record) => record.status === "Verified").length} /><SummaryCard icon="alert" label="Needs review" value={records.filter((record) => record.status !== "Verified").length} /></div>{selectedRecord && <Alert title={`Selected record ${selectedRecord.id}`} variant="info">The header search opened this mock record: {selectedRecord.name} at {selectedRecord.plot}.</Alert>}{addOpen && <AddBurialForm onCancel={() => setAddOpen(false)} onSubmit={addRecord} />}<Card><CardHeader><CardTitle>Mock burial records</CardTitle><Badge variant="neutral">Local prototype data</Badge></CardHeader><Table caption="Mock burial records"><TableHead><TableRow><TableHeaderCell>Record</TableHeaderCell><TableHeaderCell>Plot</TableHeaderCell><TableHeaderCell>Section</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Updated</TableHeaderCell></TableRow></TableHead><TableBody>{records.map((record) => <TableRow key={record.id}><TableCell><strong>{record.name}</strong><span className="table-secondary">{record.id}</span></TableCell><TableCell>{record.plot}</TableCell><TableCell>{record.section}</TableCell><TableCell><Badge variant={record.status === "Verified" ? "success" : record.status === "Draft" ? "neutral" : "warning"}>{record.status}</Badge></TableCell><TableCell>{record.updated}</TableCell></TableRow>)}</TableBody></Table></Card></AdminPageFrame>;
}

export function AdminCemeteryMapPage() {
  return <AdminPageFrame title="Cemetery Map" description="Preview plot occupancy and map coverage by cemetery section."><div className="admin-map-preview"><div className="admin-map-preview__road admin-map-preview__road--horizontal" /><div className="admin-map-preview__road admin-map-preview__road--vertical" />{adminSections.map((section, index) => <div className={`admin-map-zone admin-map-zone--${index + 1}`} key={section.name}><strong>{section.name}</strong><span>{section.occupied.toLocaleString()} occupied</span></div>)}</div><div className="admin-summary-grid">{adminSections.map((section) => <Card key={section.name}><CardContent><p className="admin-card-label">{section.name}</p><h2 className="admin-card-value">{Math.round((section.occupied / section.plots) * 100)}%</h2><p className="admin-card-muted">{section.description} · {section.plots.toLocaleString()} plots</p></CardContent></Card>)}</div><Alert icon="info" title="Map preview only" variant="info">This map uses local occupancy values and does not load coordinates or tiles from a backend.</Alert></AdminPageFrame>;
}

export function AdminVerificationPage({ selectedPlot = "" }: { selectedPlot?: string }) {
  const selectedIssue = getAdminVerificationIssue(selectedPlot);
  return <AdminPageFrame title="Coordinate Verification" description="Review placeholder issues before a future coordinate import." actions={<Button icon="check" variant="secondary">Mark selected verified</Button>}>{selectedIssue && <Alert icon="target" title={`Reviewing ${selectedIssue.plot}`} variant="warning">{selectedIssue.issue}. This issue was opened from a dashboard Review action.</Alert>}<Card><CardHeader><CardTitle>Verification queue</CardTitle><Badge variant="danger">{adminVerificationIssues.length} shown</Badge></CardHeader><Table caption="Coordinate verification queue"><TableHead><TableRow><TableHeaderCell>Plot ID</TableHeaderCell><TableHeaderCell>Issue</TableHeaderCell><TableHeaderCell>Priority</TableHeaderCell><TableHeaderCell>Date flagged</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHead><TableBody>{adminVerificationIssues.map((issue) => <TableRow key={issue.id}><TableCell className="strong-cell">{issue.plot}</TableCell><TableCell>{issue.issue}</TableCell><TableCell><Badge variant={issue.priority === "High" ? "danger" : issue.priority === "Medium" ? "warning" : "neutral"}>{issue.priority}</Badge></TableCell><TableCell>{issue.date}</TableCell><TableCell><Button size="sm" variant="secondary">Review</Button></TableCell></TableRow>)}</TableBody></Table></Card></AdminPageFrame>;
}

export function AdminPlotManagementPage() {
  return <AdminPageFrame title="Plot Management" description="View placeholder occupancy and section capacity." actions={<Button icon="plus">Add section</Button>}><Card><CardHeader><CardTitle>Section capacity</CardTitle><Badge variant="neutral">4 active sections</Badge></CardHeader><Table caption="Plot occupancy by section"><TableHead><TableRow><TableHeaderCell>Section</TableHeaderCell><TableHeaderCell>Description</TableHeaderCell><TableHeaderCell>Occupied</TableHeaderCell><TableHeaderCell>Available</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableRow></TableHead><TableBody>{adminPlotOccupancy.map((section) => <TableRow key={section.section}><TableCell className="strong-cell">{section.section}</TableCell><TableCell>{adminSections.find((item) => item.name === section.section)?.description}</TableCell><TableCell>{section.occupied.toLocaleString()}</TableCell><TableCell>{(section.total - section.occupied).toLocaleString()}</TableCell><TableCell><Badge variant="success">{section.status}</Badge></TableCell></TableRow>)}</TableBody></Table></Card></AdminPageFrame>;
}

export function AdminPhotosPage() {
  return <AdminPageFrame title="Photos" description="Manage placeholder cemetery and headstone photography." actions={<Button icon="upload" variant="secondary">Upload photo</Button>}><Card><CardContent><EmptyState action={<Button icon="upload" size="sm" variant="secondary">Add a mock photo</Button>} description="Photo uploads are not connected yet. Add the storage workflow after the data model is approved." icon="photos" title="No photos in this prototype" /></CardContent></Card></AdminPageFrame>;
}

export function AdminReportsPage() {
  const [generated, setGenerated] = useState(false);
  return <AdminPageFrame title="Reports" description="Generate placeholder summaries for cemetery operations." actions={<Button icon="chart" onClick={() => setGenerated(true)}>Generate report</Button>}>{generated && <Alert icon="check" title="Mock report ready" variant="success">A report preview was generated locally. No file was uploaded or saved.</Alert>}<div className="admin-summary-grid">{adminReportSummaries.map((report) => <Card key={report.title}><CardContent><span className="metric-icon"><Icon name={report.icon} size={21} /></span><h2 className="admin-card-title">{report.title}</h2><p className="admin-card-muted">{report.description}</p><strong className="admin-card-value admin-card-value--small">{report.value}</strong><button className="text-button admin-card-action" onClick={() => setGenerated(true)} type="button">Preview report</button></CardContent></Card>)}</div></AdminPageFrame>;
}

export function AdminAuditLogPage() {
  return <AdminPageFrame title="Audit Log" description="Review a chronological list of placeholder administrator changes."><Card><CardHeader><CardTitle>Recent record changes</CardTitle><Badge variant="neutral">Mock activity</Badge></CardHeader><div className="change-list">{adminRecentChanges.concat({ icon: "settings", title: "Dashboard preferences viewed", description: "A placeholder settings page was opened.", time: "2d ago" }).map((change) => <div className="change-item" key={change.title}><span className="change-item__icon"><Icon name={change.icon} size={16} /></span><div><p>{change.title}</p><span>{change.description}</span></div><time>{change.time}</time></div>)}</div></Card></AdminPageFrame>;
}

export function AdminSettingsPage() {
  return <AdminPageFrame title="Settings" description="Preview administrator preferences and workspace configuration."><div className="admin-settings-grid"><SettingCard icon="shield" title="Workspace access" description="Authentication is intentionally not implemented in this prototype." /><SettingCard icon="map" title="Map display" description="Use the approved cemetery map settings when the backend is connected." /><SettingCard icon="bell" title="Notifications" description="Mock alerts are currently displayed only in the administrator header." /></div><Alert icon="info" title="No settings are saved" variant="info">These controls are presentation-only and do not change account or system configuration.</Alert></AdminPageFrame>;
}

export function AdminSupportPage() {
  return <AdminPageFrame title="Support" description="Find placeholder help resources for cemetery administrators."><div className="admin-settings-grid"><SettingCard icon="help" title="Prototype guide" description="Use the sidebar to review each administrator area and its mock state." /><SettingCard icon="support" title="Contact support" description="Support contact details will be added after the project workflow is approved." /></div><EmptyState description="No support tickets are connected yet." icon="support" title="No open support requests" /></AdminPageFrame>;
}

function AdminPageFrame({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) { return <div className="admin-page-frame"><PageHeading actions={actions} description={description} eyebrow="Administrator workspace" title={title} />{children}</div>; }
function SummaryCard({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) { return <Card className="summary-card"><div className="metric-card__top"><span className="metric-icon"><Icon name={icon} size={20} /></span><span>{label}</span></div><p className="metric-value">{value}</p></Card>; }
function SettingCard({ icon, title, description }: { icon: IconName; title: string; description: string }) { return <Card><CardContent><span className="metric-icon"><Icon name={icon} size={21} /></span><h2 className="admin-card-title">{title}</h2><p className="admin-card-muted">{description}</p><button className="text-button admin-card-action" type="button">View mock option</button></CardContent></Card>; }

function AddBurialForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (record: NewBurialRecord) => void }) {
  const [name, setName] = useState("");
  const [plot, setPlot] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !plot.trim()) return;
    onSubmit({ name: name.trim(), plot: plot.trim(), section: "Unassigned", year: "—", status: "Draft" });
    setMessage("Mock burial record added to this page.");
  }

  return <Card className="admin-form-card"><CardHeader><CardTitle>Add Burial Record</CardTitle><Badge variant="info">Mock form</Badge></CardHeader><CardContent><form className="admin-form" onSubmit={submit}><Input label="Record label" onChange={(event) => setName(event.target.value)} placeholder="e.g. Memorial Record 005" value={name} /><Input label="Plot ID" onChange={(event) => setPlot(event.target.value)} placeholder="e.g. A-015-03" value={plot} /><div className="admin-form-actions"><Button onClick={onCancel} type="button" variant="secondary">Cancel</Button><Button icon="check" type="submit">Add mock record</Button></div>{message && <Alert icon="check" title="Success" variant="success">{message}</Alert>}</form></CardContent></Card>;
}
