import type { IconName } from "@/components/ui/icons";

export type AdminBurialRecord = { id: string; name: string; plot: string; section: string; year: string; status: "Verified" | "Needs review" | "Draft"; updated: string };
export type AdminPlotOccupancy = { section: string; occupied: number; total: number; status: string };
export type AdminVerificationIssue = { id: string; plot: string; issue: string; date: string; priority: "High" | "Medium" | "Low" };
export type AdminRecentChange = { icon: IconName; title: string; description: string; time: string };
export type AdminSection = { name: string; description: string; plots: number; occupied: number };
export type AdminReportSummary = { title: string; description: string; value: string; icon: IconName };

export const adminBurialRecords: AdminBurialRecord[] = [
  { id: "BN-1001", name: "Memorial Record 001", plot: "A-015-02", section: "Section A", year: "1962", status: "Verified", updated: "Today, 09:20" },
  { id: "BN-1002", name: "Memorial Record 002", plot: "B-118-04", section: "Section B", year: "1978", status: "Verified", updated: "Yesterday" },
  { id: "BN-1003", name: "Memorial Record 003", plot: "C-207-01", section: "Section C", year: "1984", status: "Needs review", updated: "2 days ago" },
  { id: "BN-1004", name: "Memorial Record 004", plot: "D-440-01", section: "Section D", year: "2001", status: "Draft", updated: "3 days ago" },
];

export const adminPlotOccupancy: AdminPlotOccupancy[] = [
  { section: "Section A", occupied: 4200, total: 4800, status: "Active" },
  { section: "Section B", occupied: 3150, total: 3600, status: "Active" },
  { section: "Section C", occupied: 1820, total: 2400, status: "Active" },
  { section: "Section D", occupied: 950, total: 1800, status: "New" },
];

export const adminVerificationIssues: AdminVerificationIssue[] = [
  { id: "V-001", plot: "A-015-02", issue: "GPS coordinates mismatch over 5m", date: "Oct 24, 2023", priority: "High" },
  { id: "V-002", plot: "C-112-99", issue: "Missing headstone photograph", date: "Oct 22, 2023", priority: "Medium" },
  { id: "V-003", plot: "D-440-01", issue: "Record needs coordinate review", date: "Oct 20, 2023", priority: "Low" },
];

export const adminRecentChanges: AdminRecentChange[] = [
  { icon: "records", title: "Record BN-1003 updated", description: "A mock burial record is awaiting review.", time: "2h ago" },
  { icon: "location", title: "New coordinate scan uploaded", description: "Section D field mapping has a new placeholder scan.", time: "5h ago" },
  { icon: "userSearch", title: "New mock record created", description: "Record BN-1004 was added to Plot D-440-01.", time: "1d ago" },
];

export const adminSections: AdminSection[] = [
  { name: "Section A", description: "Historic garden", plots: 4800, occupied: 4200 },
  { name: "Section B", description: "Central lawn", plots: 3600, occupied: 3150 },
  { name: "Section C", description: "West garden", plots: 2400, occupied: 1820 },
  { name: "Section D", description: "New memorial area", plots: 1800, occupied: 950 },
];

export const adminReportSummaries: AdminReportSummary[] = [
  { title: "Burial records summary", description: "A mock export of record counts by section.", value: "12,458 records", icon: "records" },
  { title: "Plot occupancy report", description: "A mock capacity report for active sections.", value: "81.2% occupied", icon: "grid" },
  { title: "Verification queue", description: "A mock list of unresolved coordinate issues.", value: "45 items", icon: "verification" },
];

export function searchAdminRecords(query = "") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return adminBurialRecords.filter((record) => [record.id, record.name, record.plot, record.section].some((value) => value.toLowerCase().includes(normalized)));
}

export function getAdminRecord(id: string) {
  return adminBurialRecords.find((record) => record.id === id);
}

export function getAdminVerificationIssue(plot: string) {
  return adminVerificationIssues.find((issue) => issue.plot === plot);
}
