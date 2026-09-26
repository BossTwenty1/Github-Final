"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icons";
import type { DashboardCounts } from "@/lib/supabase/admin-data";
import type { AdminRecord } from "@/lib/supabase/types";

type RecordStatus = AdminRecord["recordStatus"];
type VerificationFilter = AdminRecord["coordinateStatus"] | "verified" | "all";
type DateFilter = "all" | "this-year" | "last-five-years" | "undated";

type BurialRecordListProps = {
  records: AdminRecord[];
  total: number | null;
  counts: DashboardCounts | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  busy: boolean;
  canAdmin: boolean;
  initialQuery?: string;
  selectedRecordId?: string;
  onAdd: () => void;
  onEdit: (record: AdminRecord) => void;
  onDelete: (record: AdminRecord) => void;
  onChangeStatus: (record: AdminRecord, status: RecordStatus) => void;
  onBatchStatus: (records: AdminRecord[], status: RecordStatus) => void;
  onLoadMore: () => void;
};

export function BurialRecordList({
  records,
  total,
  counts,
  loading,
  loadingMore,
  hasMore,
  busy,
  canAdmin,
  initialQuery = "",
  selectedRecordId = "",
  onAdd,
  onEdit,
  onDelete,
  onChangeStatus,
  onBatchStatus,
  onLoadMore,
}: BurialRecordListProps) {
  const [query, setQuery] = useState(initialQuery);
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState<RecordStatus | "all">("all");
  const [verification, setVerification] =
    useState<VerificationFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const sections = useMemo(
    () => [...new Set(records.map((record) => record.section))].sort(),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const currentYear = new Date().getFullYear();

    return records.filter((record) => {
      const searchable = [
        record.name,
        record.referenceNo,
        String(record.burialId),
        record.plot,
        record.section,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesSection = section === "all" || record.section === section;
      const matchesStatus = status === "all" || record.recordStatus === status;
      const matchesVerification = getVerificationKey(record) === verification
        || verification === "all";
      const intermentYear = record.intermentDate
        ? Number(record.intermentDate.slice(0, 4))
        : null;
      const matchesDate = dateFilter === "all"
        || (dateFilter === "undated" && !intermentYear)
        || (dateFilter === "this-year" && intermentYear === currentYear)
        || (
          dateFilter === "last-five-years"
          && intermentYear !== null
          && intermentYear >= currentYear - 4
        );

      return matchesQuery
        && matchesSection
        && matchesStatus
        && matchesVerification
        && matchesDate;
    });
  }, [dateFilter, query, records, section, status, verification]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleRecords = filteredRecords.slice(pageStart, pageStart + pageSize);
  const selectedRecords = records.filter((record) => selectedIds.has(record.burialId));
  const visibleIds = visibleRecords.map((record) => record.burialId);
  const allVisibleSelected = visibleIds.length > 0
    && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const hasFilters = Boolean(query.trim())
    || section !== "all"
    || status !== "all"
    || verification !== "all"
    || dateFilter !== "all";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  function toggleRecord(recordId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setSection("all");
    setStatus("all");
    setVerification("all");
    setDateFilter("all");
    setPage(0);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setPage(0);
  }

  function updateSection(value: string) {
    setSection(value);
    setPage(0);
  }

  function updateStatus(value: RecordStatus | "all") {
    setStatus(value);
    setPage(0);
  }

  function updateVerification(value: VerificationFilter) {
    setVerification(value);
    setPage(0);
  }

  function updateDateFilter(value: DateFilter) {
    setDateFilter(value);
    setPage(0);
  }

  function updatePageSize(value: number) {
    setPageSize(value);
    setPage(0);
  }

  function runBatchAction(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as RecordStatus | "";
    if (nextStatus && selectedRecords.length) {
      onBatchStatus(selectedRecords, nextStatus);
    }
    event.target.value = "";
  }

  const recordTotal = total ?? records.length;
  const loadedLabel = hasMore ? `${records.length.toLocaleString()}+` : records.length.toLocaleString();

  return (
    <section className="admin-burial-list" aria-labelledby="burial-records-title">
      <BurialRecordHeader
        busy={busy}
        filteredRecords={filteredRecords}
        onAdd={onAdd}
        onBatchAction={runBatchAction}
        recordTotal={recordTotal}
        selectedCount={selectedRecords.length}
      />

      <BurialRecordMetrics
        counts={counts}
        loading={loading}
        total={total}
      />

      <BurialRecordFilters
        dateFilter={dateFilter}
        hasFilters={hasFilters}
        loadedLabel={loadedLabel}
        query={query}
        section={section}
        sections={sections}
        status={status}
        verification={verification}
        onDateFilterChange={updateDateFilter}
        onQueryChange={updateQuery}
        onReset={resetFilters}
        onSectionChange={updateSection}
        onStatusChange={updateStatus}
        onVerificationChange={updateVerification}
      />

      {hasFilters ? (
        <ActiveFilterChips
          dateFilter={dateFilter}
          query={query}
          section={section}
          status={status}
          verification={verification}
          onDateFilterChange={updateDateFilter}
          onQueryChange={updateQuery}
          onSectionChange={updateSection}
          onStatusChange={updateStatus}
          onVerificationChange={updateVerification}
        />
      ) : null}

      <div className="admin-burial-data-panel">
        {loading ? (
          <BurialRecordLoading />
        ) : visibleRecords.length ? (
          <>
            <BurialRecordTable
              allVisibleSelected={allVisibleSelected}
              busy={busy}
              canAdmin={canAdmin}
              records={visibleRecords}
              selectAllRef={selectAllRef}
              selectedIds={selectedIds}
              selectedRecordId={selectedRecordId}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleRecord={toggleRecord}
              onToggleVisible={toggleVisible}
            />
            <BurialRecordMobileCards
              busy={busy}
              canAdmin={canAdmin}
              records={visibleRecords}
              selectedIds={selectedIds}
              selectedRecordId={selectedRecordId}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleRecord={toggleRecord}
            />
            <BurialRecordPagination
              filteredCount={filteredRecords.length}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadedCount={records.length}
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
              recordTotal={recordTotal}
              visibleCount={visibleRecords.length}
              onLoadMore={onLoadMore}
              onPageChange={setPage}
              onPageSizeChange={updatePageSize}
            />
          </>
        ) : (
          <EmptyState
            action={
              hasFilters
                ? <Button onClick={resetFilters} variant="secondary">Clear filters</Button>
                : <Button icon="plus" onClick={onAdd}>Add burial record</Button>
            }
            className="admin-burial-empty"
            description={
              hasFilters
                ? "No loaded burial records match these filters. Clear them or load another batch."
                : "Create a protected burial record by selecting an available plot."
            }
            icon={hasFilters ? "filter" : "records"}
            title={hasFilters ? "No matching records" : "No burial records"}
          />
        )}
      </div>

      {counts && counts.unverified > 0 ? (
        <div className="admin-burial-coordinate-note">
          <span className="admin-section-icon admin-section-icon--danger">
            <Icon name="verification" size={20} />
          </span>
          <div>
            <strong>
              {counts.unverified.toLocaleString()} plots need coordinate review
            </strong>
            <span>
              Review missing, pending, or rejected coordinates in the protected workflow.
            </span>
          </div>
          {canAdmin ? (
            <Link href="/admin/coordinate-verification">
              Review coordinates <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type HeaderProps = {
  recordTotal: number;
  selectedCount: number;
  busy: boolean;
  filteredRecords: AdminRecord[];
  onAdd: () => void;
  onBatchAction: (event: ChangeEvent<HTMLSelectElement>) => void;
};

function BurialRecordHeader({
  recordTotal,
  selectedCount,
  busy,
  filteredRecords,
  onAdd,
  onBatchAction,
}: HeaderProps) {
  return (
    <header className="admin-burial-heading">
      <div>
        <div className="admin-burial-heading__title-row">
          <h1 id="burial-records-title">Burial Records</h1>
          <Badge variant="success">{recordTotal.toLocaleString()} total</Badge>
        </div>
        <p>
          Manage, cross-reference, and audit cemetery interments and registry plots.
        </p>
      </div>
      <div className="admin-burial-heading__actions">
        <label className="admin-burial-batch-control">
          <Icon name="check" size={17} />
          <span>{selectedCount ? `${selectedCount} selected` : "Batch actions"}</span>
          <select
            aria-label="Apply an action to selected burial records"
            defaultValue=""
            disabled={!selectedCount || busy}
            onChange={onBatchAction}
          >
            <option disabled value="">Choose</option>
            <option value="active">Activate selected</option>
            <option value="archived">Archive selected</option>
          </select>
        </label>
        <Button
          disabled={!filteredRecords.length}
          icon="download"
          onClick={() => downloadRecordsCsv(filteredRecords)}
          variant="secondary"
        >
          Export view
        </Button>
        <Button icon="plus" onClick={onAdd}>Add new record</Button>
      </div>
    </header>
  );
}

function BurialRecordMetrics({
  counts,
  loading,
  total,
}: {
  counts: DashboardCounts | null;
  loading: boolean;
  total: number | null;
}) {
  if (loading) {
    return (
      <div aria-label="Loading burial record totals" className="admin-burial-metrics" role="status">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="admin-burial-metric admin-burial-metric--loading" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="admin-burial-metrics">
      <BurialMetric icon="records" label="Total burial records" value={total} />
      <BurialMetric icon="check" label="Active records" tone="success" value={counts?.active} />
      <BurialMetric icon="clock" label="Pending review" tone="warning" value={counts?.pending} />
      <BurialMetric icon="audit" label="Archived records" value={counts?.archived} />
    </div>
  );
}

function BurialMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: IconName;
  label: string;
  value: number | null | undefined;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className={`admin-burial-metric admin-burial-metric--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value === null || value === undefined ? "—" : value.toLocaleString()}</strong>
      </div>
      <span className="admin-burial-metric__icon">
        <Icon name={icon} size={20} />
      </span>
    </div>
  );
}

type FilterProps = {
  query: string;
  section: string;
  sections: string[];
  status: RecordStatus | "all";
  verification: VerificationFilter;
  dateFilter: DateFilter;
  hasFilters: boolean;
  loadedLabel: string;
  onQueryChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onStatusChange: (value: RecordStatus | "all") => void;
  onVerificationChange: (value: VerificationFilter) => void;
  onDateFilterChange: (value: DateFilter) => void;
  onReset: () => void;
};

function BurialRecordFilters({
  query,
  section,
  sections,
  status,
  verification,
  dateFilter,
  hasFilters,
  loadedLabel,
  onQueryChange,
  onSectionChange,
  onStatusChange,
  onVerificationChange,
  onDateFilterChange,
  onReset,
}: FilterProps) {
  return (
    <div className="admin-burial-toolbar">
      <label className="admin-burial-search">
        <span className="sr-only">Search loaded burial records</span>
        <Icon name="search" size={18} />
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search loaded names, IDs, plots, or sections..."
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear burial record search"
            onClick={() => onQueryChange("")}
            type="button"
          >
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </label>
      <div className="admin-burial-filter-controls">
        <FilterSelect
          label="Section"
          value={section}
          onChange={onSectionChange}
          options={[
            ["all", "All sections"],
            ...sections.map((item) => [item, item] as [string, string]),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => onStatusChange(value as RecordStatus | "all")}
          options={[
            ["all", "All statuses"],
            ["active", "Active"],
            ["pending", "Pending"],
            ["archived", "Archived"],
          ]}
        />
        <FilterSelect
          label="Verification"
          value={verification}
          onChange={(value) => onVerificationChange(value as VerificationFilter)}
          options={[
            ["all", "All states"],
            ["verified", "Verified"],
            ["pending", "Pending"],
            ["rejected", "Rejected"],
          ]}
        />
        <FilterSelect
          label="Burial date"
          value={dateFilter}
          onChange={(value) => onDateFilterChange(value as DateFilter)}
          options={[
            ["all", "All time"],
            ["this-year", "This year"],
            ["last-five-years", "Last five years"],
            ["undated", "Date not recorded"],
          ]}
        />
        <button
          aria-label="Reset burial record filters"
          className="admin-burial-reset"
          disabled={!hasFilters}
          onClick={onReset}
          title="Reset filters"
          type="button"
        >
          <Icon name="filter" size={17} />
          <span>Reset</span>
        </button>
      </div>
      <p className="admin-burial-toolbar__scope">
        Filters apply to {loadedLabel} protected records currently loaded.
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-burial-filter-select">
      <span>{label}</span>
      <select
        aria-label={`Filter burial records by ${label.toLocaleLowerCase()}`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
      <Icon name="chevronDown" size={15} />
    </label>
  );
}

function ActiveFilterChips({
  query,
  section,
  status,
  verification,
  dateFilter,
  onQueryChange,
  onSectionChange,
  onStatusChange,
  onVerificationChange,
  onDateFilterChange,
}: Omit<FilterProps, "sections" | "hasFilters" | "loadedLabel" | "onReset">) {
  const chips = [
    query ? { label: `Search: ${query}`, clear: () => onQueryChange("") } : null,
    section !== "all" ? { label: `Section: ${section}`, clear: () => onSectionChange("all") } : null,
    status !== "all" ? { label: `Status: ${status}`, clear: () => onStatusChange("all") } : null,
    verification !== "all"
      ? { label: `Verification: ${verification}`, clear: () => onVerificationChange("all") }
      : null,
    dateFilter !== "all"
      ? { label: `Date: ${dateFilter.replaceAll("-", " ")}`, clear: () => onDateFilterChange("all") }
      : null,
  ].filter((chip): chip is { label: string; clear: () => void } => Boolean(chip));

  return (
    <div aria-label="Active burial record filters" className="admin-burial-filter-chips">
      <span>Active filters</span>
      {chips.map((chip) => (
        <button key={chip.label} onClick={chip.clear} type="button">
          {chip.label}
          <Icon name="x" size={14} />
        </button>
      ))}
    </div>
  );
}

type RecordListPresentationProps = {
  records: AdminRecord[];
  selectedIds: Set<number>;
  selectedRecordId: string;
  busy: boolean;
  canAdmin: boolean;
  onToggleRecord: (recordId: number) => void;
  onEdit: (record: AdminRecord) => void;
  onDelete: (record: AdminRecord) => void;
  onChangeStatus: (record: AdminRecord, status: RecordStatus) => void;
};

function BurialRecordTable({
  records,
  selectedIds,
  selectedRecordId,
  busy,
  canAdmin,
  allVisibleSelected,
  selectAllRef,
  onToggleVisible,
  onToggleRecord,
  onEdit,
  onDelete,
  onChangeStatus,
}: RecordListPresentationProps & {
  allVisibleSelected: boolean;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onToggleVisible: () => void;
}) {
  return (
    <div className="admin-burial-table-wrap">
      <table className="admin-burial-table">
        <caption className="sr-only">
          Protected GraveNav burial records currently loaded from Supabase
        </caption>
        <thead>
          <tr>
            <th className="admin-burial-table__select" scope="col">
              <label className="admin-record-checkbox">
                <input
                  aria-label="Select all visible burial records"
                  checked={allVisibleSelected}
                  onChange={onToggleVisible}
                  ref={selectAllRef}
                  type="checkbox"
                />
                <span />
              </label>
            </th>
            <th scope="col">Deceased name &amp; ID</th>
            <th scope="col">Lifespan</th>
            <th scope="col">Burial date</th>
            <th scope="col">Plot location</th>
            <th scope="col">Record status</th>
            <th scope="col">Verification</th>
            <th className="admin-burial-table__actions-heading" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isSelected = selectedIds.has(record.burialId);
            const isCurrent = String(record.burialId) === selectedRecordId;
            return (
              <tr
                className={isCurrent ? "admin-burial-table__row--current" : undefined}
                data-selected={isSelected || undefined}
                key={record.burialId}
              >
                <td className="admin-burial-table__select">
                  <label className="admin-record-checkbox">
                    <input
                      aria-label={`Select ${record.name}`}
                      checked={isSelected}
                      onChange={() => onToggleRecord(record.burialId)}
                      type="checkbox"
                    />
                    <span />
                  </label>
                </td>
                <td><RecordIdentity record={record} /></td>
                <td><RecordLifespan record={record} /></td>
                <td>{formatDate(record.intermentDate)}</td>
                <td><PlotLabel record={record} /></td>
                <td><RecordStatusBadge status={record.recordStatus} /></td>
                <td><VerificationBadge record={record} /></td>
                <td>
                  <RecordActions
                    busy={busy}
                    canAdmin={canAdmin}
                    record={record}
                    onChangeStatus={onChangeStatus}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BurialRecordMobileCards({
  records,
  selectedIds,
  selectedRecordId,
  busy,
  canAdmin,
  onToggleRecord,
  onEdit,
  onDelete,
  onChangeStatus,
}: RecordListPresentationProps) {
  return (
    <div className="admin-burial-mobile-list">
      {records.map((record) => {
        const isSelected = selectedIds.has(record.burialId);
        const isCurrent = String(record.burialId) === selectedRecordId;
        return (
          <article
            className="admin-burial-mobile-card"
            data-current={isCurrent || undefined}
            data-selected={isSelected || undefined}
            key={record.burialId}
          >
            <div className="admin-burial-mobile-card__top">
              <label className="admin-record-checkbox">
                <input
                  aria-label={`Select ${record.name}`}
                  checked={isSelected}
                  onChange={() => onToggleRecord(record.burialId)}
                  type="checkbox"
                />
                <span />
              </label>
              <RecordIdentity record={record} />
              <RecordStatusBadge status={record.recordStatus} />
            </div>
            <dl className="admin-burial-mobile-card__details">
              <div><dt>Plot</dt><dd><PlotLabel record={record} /></dd></div>
              <div><dt>Burial date</dt><dd>{formatDate(record.intermentDate)}</dd></div>
              <div><dt>Lifespan</dt><dd><RecordLifespan record={record} /></dd></div>
              <div><dt>Verification</dt><dd><VerificationBadge record={record} /></dd></div>
            </dl>
            <RecordActions
              busy={busy}
              canAdmin={canAdmin}
              record={record}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </article>
        );
      })}
    </div>
  );
}

function RecordIdentity({ record }: { record: AdminRecord }) {
  return (
    <div className="admin-record-identity">
      <span aria-hidden="true" className="admin-record-avatar">
        {getInitials(record.name)}
      </span>
      <span>
        <strong>{record.name}</strong>
        <small>{record.referenceNo || `Record #${record.burialId}`}</small>
      </span>
    </div>
  );
}

function RecordLifespan({ record }: { record: AdminRecord }) {
  if (!record.birthDate && !record.deathDate) {
    return <span className="admin-record-muted">Not recorded</span>;
  }
  return (
    <span className="admin-record-lifespan">
      <Icon name="clock" size={14} />
      {formatDate(record.birthDate)} – {formatDate(record.deathDate)}
    </span>
  );
}

function PlotLabel({ record }: { record: AdminRecord }) {
  return (
    <span className="admin-record-plot">
      <Icon name="location" size={14} />
      <span>{record.section} · {record.plot}</span>
    </span>
  );
}

function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const label = status[0].toLocaleUpperCase() + status.slice(1);
  return (
    <span className={`admin-record-status admin-record-status--${status}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function VerificationBadge({ record }: { record: AdminRecord }) {
  const key = getVerificationKey(record);
  const label = key === "verified"
    ? "Verified"
    : key === "rejected"
      ? "Rejected"
      : record.location
        ? "Pending review"
        : "Coordinates missing";
  return (
    <span className={`admin-record-verification admin-record-verification--${key}`}>
      <Icon name={key === "verified" ? "check" : "verification"} size={14} />
      {label}
    </span>
  );
}

function RecordActions({
  record,
  busy,
  canAdmin,
  onEdit,
  onDelete,
  onChangeStatus,
}: {
  record: AdminRecord;
  busy: boolean;
  canAdmin: boolean;
  onEdit: (record: AdminRecord) => void;
  onDelete: (record: AdminRecord) => void;
  onChangeStatus: (record: AdminRecord, status: RecordStatus) => void;
}) {
  const nextStatus = record.recordStatus === "active" ? "archived" : "active";
  return (
    <div className="admin-record-actions">
      <Link
        aria-label={`View ${record.name}`}
        href={`/admin/burial-records?record=${record.burialId}`}
        title="View selected record"
      >
        <Icon name="eye" size={17} />
      </Link>
      <button
        aria-label={`Edit ${record.name}`}
        disabled={busy}
        onClick={() => onEdit(record)}
        title="Edit record"
        type="button"
      >
        <Icon name="edit" size={17} />
      </button>
      <button
        aria-label={`${nextStatus === "active" ? "Activate" : "Archive"} ${record.name}`}
        disabled={busy}
        onClick={() => onChangeStatus(record, nextStatus)}
        title={nextStatus === "active" ? "Activate record" : "Archive record"}
        type="button"
      >
        <Icon name={nextStatus === "active" ? "check" : "audit"} size={17} />
      </button>
      <button
        aria-label={`Delete ${record.name}`}
        className="admin-record-actions__danger"
        disabled={busy || !canAdmin}
        onClick={() => onDelete(record)}
        title={canAdmin ? "Delete record" : "Only administrators can remove records"}
        type="button"
      >
        <Icon name="trash" size={17} />
      </button>
    </div>
  );
}

type PaginationProps = {
  filteredCount: number;
  visibleCount: number;
  loadedCount: number;
  recordTotal: number;
  page: number;
  pageCount: number;
  pageSize: number;
  hasMore: boolean;
  loadingMore: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onLoadMore: () => void;
};

function BurialRecordPagination({
  filteredCount,
  visibleCount,
  loadedCount,
  recordTotal,
  page,
  pageCount,
  pageSize,
  hasMore,
  loadingMore,
  onPageChange,
  onPageSizeChange,
  onLoadMore,
}: PaginationProps) {
  const first = filteredCount ? page * pageSize + 1 : 0;
  const last = filteredCount ? first + visibleCount - 1 : 0;
  const pages = getPageWindow(page, pageCount);

  return (
    <footer className="admin-burial-pagination">
      <div aria-live="polite" className="admin-burial-pagination__summary">
        <span>
          Showing <strong>{first.toLocaleString()}</strong> to <strong>{last.toLocaleString()}</strong>
          {" "}of <strong>{filteredCount.toLocaleString()}</strong> matching loaded entries
        </span>
        <span className="admin-burial-pagination__loaded">
          {loadedCount.toLocaleString()} of {recordTotal.toLocaleString()} records loaded
        </span>
        <label>
          <span>Per page</span>
          <select
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
      <nav aria-label="Burial record pages" className="admin-burial-pagination__controls">
        <button
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Previous
        </button>
        {pages.map((pageNumber) => (
          <button
            aria-current={pageNumber === page ? "page" : undefined}
            className={pageNumber === page ? "is-current" : undefined}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            type="button"
          >
            {pageNumber + 1}
          </button>
        ))}
        <button
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Next
        </button>
        {hasMore ? (
          <button
            className="admin-burial-pagination__load"
            disabled={loadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {loadingMore ? "Loading…" : "Load next 50"}
          </button>
        ) : null}
      </nav>
    </footer>
  );
}

function BurialRecordLoading() {
  return (
    <div aria-label="Loading burial records" className="admin-burial-loading" role="status">
      <span className="sr-only">Loading protected burial records…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <span className="admin-burial-loading__row" key={index} />
      ))}
    </div>
  );
}

function getVerificationKey(record: AdminRecord): Exclude<VerificationFilter, "all"> {
  if (record.coordinateVerified && record.coordinateStatus === "verified") {
    return "verified";
  }
  return record.coordinateStatus === "rejected" ? "rejected" : "pending";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase() || "GN";
}

function getPageWindow(currentPage: number, pageCount: number) {
  const length = Math.min(pageCount, 5);
  const start = Math.max(0, Math.min(currentPage - 2, pageCount - length));
  return Array.from({ length }, (_, index) => start + index);
}

function downloadRecordsCsv(records: AdminRecord[]) {
  const headers = [
    "burial_id",
    "display_name",
    "reference_no",
    "section",
    "plot",
    "record_status",
    "coordinate_status",
    "interment_date",
  ];
  const rows = records.map((record) => [
    record.burialId,
    record.name,
    record.referenceNo,
    record.section,
    record.plot,
    record.recordStatus,
    getVerificationKey(record),
    record.intermentDate,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gravenav-burial-record-view.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
