"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  getAuditLogPage,
  getDashboardCounts,
  type DashboardCounts,
} from "@/lib/supabase/admin-data";
import type { AuditLogEntry } from "@/lib/supabase/types";
import { useStaff } from "./staff-context";

const EMPTY_COUNTS: DashboardCounts = {
  active: 0,
  pending: 0,
  archived: 0,
  plots: 0,
  unverified: 0,
  missingCoordinates: 0,
  pendingCoordinates: 0,
};

export function AdminFoundation() {
  const canAdmin = useStaff()?.role === "ADMIN";
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardCounts(), getAuditLogPage({ pageSize: 6 })])
      .then(([nextCounts, nextAudit]) => {
        setCounts(nextCounts);
        setAudit(nextAudit.items);
        setAuditTotal(nextAudit.total ?? nextAudit.items.length);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "The operational data could not be loaded.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const values = counts ?? EMPTY_COUNTS;
  const recordTotal = values.active + values.pending + values.archived;
  const verifiedPlots = Math.max(values.plots - values.unverified, 0);
  const otherUnverified = Math.max(
    values.unverified - values.missingCoordinates - values.pendingCoordinates,
    0,
  );

  return (
    <div className="admin-foundation">
      <div className="admin-dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of cemetery operations and protected GraveNav records.</p>
        </div>
        <div className="admin-dashboard-actions">
          {canAdmin ? (
            <Link href="/admin/coordinate-verification">
              <Button icon="target" variant="secondary">Verify coordinates</Button>
            </Link>
          ) : null}
          <Link href="/admin/reports">
            <Button icon="chart" variant="secondary">Generate report</Button>
          </Link>
          <Link href="/admin/burial-records?add=1">
            <Button icon="plus">Add burial record</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Alert icon="alert" title="Supabase data connection unavailable" variant="danger">
          {error}
        </Alert>
      ) : null}

      {loading ? <DashboardLoading /> : null}

      {!loading && counts ? (
        <>
          <div className="admin-dashboard-metrics">
            <AdminStatCard
              detail={`${values.pending.toLocaleString()} pending · ${values.archived.toLocaleString()} archived`}
              href="/admin/burial-records"
              icon="records"
              label="Active records"
              value={values.active}
            />
            <AdminStatCard
              detail="Current non-deleted plot inventory"
              href="/admin/plot-management"
              icon="grid"
              label="Known plots"
              value={values.plots}
            />
            <AdminStatCard
              danger={values.unverified > 0}
              detail={`${values.missingCoordinates.toLocaleString()} missing coordinates`}
              href={canAdmin ? "/admin/coordinate-verification" : "/admin/plot-management"}
              icon="verification"
              label="Needs coordinate review"
              value={values.unverified}
            />
            <AdminStatCard
              detail="Protected audit trail entries"
              href="/admin/audit-log"
              icon="audit"
              label="Audit events"
              value={auditTotal}
            />
          </div>

          <div className="admin-dashboard-primary-grid">
            <Card className="admin-dashboard-panel">
              <CardHeader>
                <div>
                  <CardTitle>Record status</CardTitle>
                  <p className="admin-panel-description">
                    Current burial records grouped by workflow state
                  </p>
                </div>
                <Badge variant="info">{recordTotal.toLocaleString()} total</Badge>
              </CardHeader>
              <CardContent className="admin-status-list">
                <StatusBar
                  label="Active"
                  tone="success"
                  total={recordTotal}
                  value={values.active}
                />
                <StatusBar
                  label="Pending"
                  tone="warning"
                  total={recordTotal}
                  value={values.pending}
                />
                <StatusBar
                  label="Archived"
                  tone="neutral"
                  total={recordTotal}
                  value={values.archived}
                />
              </CardContent>
              <div className="admin-panel-footer">
                <span>Source: protected burial records</span>
                <Link href="/admin/burial-records">Open records</Link>
              </div>
            </Card>

            <Card className="admin-dashboard-panel">
              <CardHeader>
                <div>
                  <CardTitle>Recent record changes</CardTitle>
                  <p className="admin-panel-description">
                    Latest events from the administrator audit trail
                  </p>
                </div>
                <Link className="text-button" href="/admin/audit-log">View all</Link>
              </CardHeader>
              {audit.length ? (
                <div className="admin-activity-list">
                  {audit.slice(0, 4).map((entry) => (
                    <ActivityItem entry={entry} key={entry.audit_id} />
                  ))}
                </div>
              ) : (
                <CardContent>
                  <EmptyState
                    description="No application changes have been recorded in this environment yet."
                    icon="audit"
                    title="No audit events"
                  />
                </CardContent>
              )}
            </Card>
          </div>

          <Card className="admin-coordinate-panel">
            <CardHeader>
              <div className="admin-section-title">
                <span className="admin-section-icon admin-section-icon--danger">
                  <Icon name="verification" size={20} />
                </span>
                <div>
                  <CardTitle>Coordinate readiness</CardTitle>
                  <p className="admin-panel-description">
                    Truthful plot-location states from the protected inventory
                  </p>
                </div>
              </div>
              {canAdmin ? (
                <Link className="text-button" href="/admin/coordinate-verification">
                  Review coordinates
                </Link>
              ) : null}
            </CardHeader>
            <div className="admin-coordinate-grid">
              <CoordinateState
                description="Coordinates approved for location guidance"
                label="Verified"
                tone="success"
                value={verifiedPlots}
              />
              <CoordinateState
                description="Coordinate captured and awaiting review"
                label="Pending review"
                tone="warning"
                value={values.pendingCoordinates}
              />
              <CoordinateState
                description="No coordinate has been stored"
                label="Missing coordinates"
                tone="danger"
                value={values.missingCoordinates}
              />
              <CoordinateState
                description="Other unverified or rejected states"
                label="Other unverified"
                tone="neutral"
                value={otherUnverified}
              />
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard data" className="admin-dashboard-loading" role="status">
      <span className="sr-only">Loading operational data…</span>
      {Array.from({ length: 4 }, (_, index) => (
        <span className="admin-dashboard-loading__card" key={index} />
      ))}
    </div>
  );
}

type StatCardProps = {
  href: string;
  icon: IconName;
  label: string;
  value: number;
  detail: string;
  danger?: boolean;
};

function AdminStatCard({ href, icon, label, value, detail, danger = false }: StatCardProps) {
  return (
    <Link className="admin-stat-card" href={href}>
      <div className="admin-stat-card__header">
        <span className={danger ? "admin-section-icon admin-section-icon--danger" : "admin-section-icon"}>
          <Icon name={icon} size={19} />
        </span>
        <span>{label}</span>
        <Icon className="admin-stat-card__more" name="more" size={18} />
      </div>
      <strong>{value.toLocaleString()}</strong>
      <span className={danger ? "admin-stat-card__detail admin-stat-card__detail--danger" : "admin-stat-card__detail"}>
        {detail}
      </span>
    </Link>
  );
}

type Tone = "success" | "warning" | "danger" | "neutral";

function StatusBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: Tone }) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="admin-status-row">
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
      </div>
      <span
        aria-label={`${label}: ${value.toLocaleString()}, ${percentage}% of records`}
        className="admin-status-track"
        role="img"
      >
        <span
          className={`admin-status-fill admin-status-fill--${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </span>
      <span>{percentage}%</span>
    </div>
  );
}

function ActivityItem({ entry }: { entry: AuditLogEntry }) {
  const label = entry.action.replaceAll("_", " ");
  return (
    <div className="admin-activity-item">
      <span className="admin-activity-item__icon">
        <Icon
          name={entry.action === "verify" ? "verification" : "records"}
          size={16}
        />
      </span>
      <div>
        <strong>{label}</strong>
        <span>{entry.table_name} · Record {entry.record_id}</span>
      </div>
      <time dateTime={entry.created_at}>{formatAuditTime(entry.created_at)}</time>
    </div>
  );
}

function CoordinateState({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: Tone;
}) {
  return (
    <div className="admin-coordinate-state">
      <span className={`admin-coordinate-state__dot admin-coordinate-state__dot--${tone}`} />
      <div>
        <span>{label}</span>
        <p>{description}</p>
      </div>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
