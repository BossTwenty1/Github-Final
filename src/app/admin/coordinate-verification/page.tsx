import { AdminShell } from "@/components/admin/admin-shell";
import { AdminVerificationPage } from "@/components/admin/admin-page-content";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCoordinateVerificationRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AdminShell active="Coordinate Verification"><AdminVerificationPage selectedPlot={getParam(params?.plot)} /></AdminShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
