import Link from "next/link";
import type { IconName } from "@/components/ui/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { adminPlotOccupancy, adminRecentChanges, adminVerificationIssues } from "@/lib/admin-mock-data";
import type { AdminRecentChange, AdminVerificationIssue } from "@/lib/admin-mock-data";

export function AdminFoundation() {
  return (
    <div className="admin-foundation">
      <PageHeading actions={<><Link href="/admin/coordinate-verification"><Button icon="target" variant="secondary">Verify coordinates</Button></Link><Link href="/admin/reports"><Button icon="chart" variant="secondary">Generate report</Button></Link><Link href="/admin/burial-records?add=1"><Button icon="plus">Add burial record</Button></Link></>} description="Overview of cemetery operations and records." eyebrow="Administrator workspace" title="Dashboard" />

      <div className="metrics-grid">
        <MetricCard href="/admin/burial-records" icon="records" label="Total records" value="12,458" trend="+12 this week" />
        <MetricCard href="/admin/plot-management" icon="grid" label="Occupied plots" value="10,120" trend="81.2% capacity" progress={81.2} />
        <MetricCard href="/admin/plot-management" icon="check" label="Available plots" value="2,338" trend="Across 4 active sections" />
        <MetricCard danger href="/admin/coordinate-verification" icon="verification" label="Verification status" value="45" trend="Plots unverified" />
      </div>

      <div className="dashboard-grid">
        <Card><CardHeader><CardTitle>Burials by section</CardTitle><button aria-label="More section options" className="icon-button" type="button"><Icon name="more" size={20} /></button></CardHeader><CardContent className="bar-list">{adminPlotOccupancy.map((section) => <Bar key={section.section} label={section.section} value={section.occupied.toLocaleString()} width={`${Math.round((section.occupied / 4200) * 100)}%`} color={section.section === "Section A" ? "bar-fill--slate" : section.section === "Section B" ? "bar-fill--green" : section.section === "Section C" ? "bar-fill--deep-green" : "bar-fill--light-green"} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Recent record changes</CardTitle><Link className="text-button" href="/admin/audit-log">View all</Link></CardHeader><div className="change-list">{adminRecentChanges.map((change) => <ChangeItem key={change.title} {...change} />)}</div></Card>
      </div>

      <Card><CardHeader className="verification-card-header"><div className="card-title-with-icon"><Icon className="text-danger" name="alert" size={21} /><CardTitle>Items needing verification</CardTitle></div><Badge variant="danger">45 items</Badge></CardHeader><Table caption="Items needing verification"><TableHead><TableRow><TableHeaderCell>Plot ID</TableHeaderCell><TableHeaderCell>Reported issue</TableHeaderCell><TableHeaderCell>Date flagged</TableHeaderCell><TableHeaderCell className="text-align-right">Action</TableHeaderCell></TableRow></TableHead><TableBody>{adminVerificationIssues.map((issue) => <VerificationRow key={issue.id} {...issue} />)}</TableBody></Table><div className="card-footer text-align-center"><Link className="text-button" href="/admin/coordinate-verification">View all pending verifications</Link></div></Card>

      <Alert className="admin-scope-note" icon="info" title="Frontend prototype only" variant="info">Dashboard values and actions use local mock data. Nothing is read from or written to a backend.</Alert>
    </div>
  );
}

type MetricCardProps = { href: string; icon: IconName; label: string; value: string; trend: string; progress?: number; danger?: boolean };
function MetricCard({ href, icon, label, value, trend, progress, danger = false }: MetricCardProps) {
  return <Link className="metric-card-link" href={href}><Card className="metric-card"><div className="metric-card__top"><span className={`metric-icon ${danger ? "metric-icon--danger" : ""}`}><Icon name={icon} size={21} /></span><span>{label}</span></div><p className="metric-value">{value}</p>{progress !== undefined ? <><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><p className="metric-trend metric-trend--muted">{trend}</p></> : <p className={`metric-trend ${danger ? "metric-trend--danger" : ""}`}>{danger && <Icon className="inline-icon" name="alert" size={13} />}{trend}</p>}</Card></Link>;
}

function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) { return <div className="bar-row"><span>{label}</span><span className="bar-track"><span className={`bar-fill ${color}`} style={{ width }} /></span><strong>{value}</strong></div>; }
function ChangeItem({ icon, title, description, time }: AdminRecentChange) { return <div className="change-item"><span className="change-item__icon"><Icon name={icon} size={16} /></span><div><p>{title}</p><span>{description}</span></div><time>{time}</time></div>; }
function VerificationRow({ plot, issue, date }: Omit<AdminVerificationIssue, "id" | "priority">) { return <TableRow><TableCell className="strong-cell">{plot}</TableCell><TableCell>{issue}</TableCell><TableCell>{date}</TableCell><TableCell className="text-align-right"><Link href={`/admin/coordinate-verification?plot=${plot}`}><Button size="sm" variant="secondary">Review</Button></Link></TableCell></TableRow>; }
