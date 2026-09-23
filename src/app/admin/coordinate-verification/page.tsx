import { AdminShell } from "@/components/admin/admin-shell";
import { CoordinateReview } from "@/components/admin/coordinate-review";
import { requireStaff } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCoordinateVerificationRoute({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("ADMIN");
  const params = await searchParams;
  return <AdminShell active="Coordinate Verification"><CoordinateReview selectedPlot={getParam(params?.plot)} /></AdminShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
