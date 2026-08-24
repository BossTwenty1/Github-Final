import { AdminShell } from "@/components/admin/admin-shell";
import { AdminBurialRecordsPage } from "@/components/admin/admin-page-content";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminBurialRecordsRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AdminShell active="Burial Records"><AdminBurialRecordsPage showAdd={getParam(params?.add) === "1"} selectedRecordId={getParam(params?.record)} /></AdminShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
