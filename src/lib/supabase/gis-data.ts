import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import {
  decodeAdminMappingReleasePage,
  decodeGisReadinessPage,
  decodePublicBurialGis,
  decodePublicMappingPage,
  parseGisBigintId,
  parseGisPage,
  parseGisPageSize,
  parseGisUuid,
  type AdminMappingLayer,
  type AdminMappingReleasePage,
  type GisReadinessPage,
  type PublicBurialGis,
  type PublicMappingLayer,
  type PublicMappingPage,
// @ts-expect-error Node's native TypeScript runner requires the explicit extension used by the contract tests.
} from "./gis-types.ts";

type RpcResult = PromiseLike<{ data: unknown; error: { message?: string } | null }>;
type RpcCaller = (name: string, args: Record<string, unknown>) => RpcResult;

async function call(client: SupabaseClient<Database>, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await (client.rpc as unknown as RpcCaller)(name,args);
  if(error) throw new Error(error.message ?? `GIS read ${name} failed`);
  return data;
}

export async function getStaffGisReadiness(client: SupabaseClient<Database>,args:{
  siteId:string; areaId:string; page?:number; pageSize?:number;
}):Promise<GisReadinessPage>{
  const page=parseGisPage(args.page??1); const pageSize=parseGisPageSize(args.pageSize??20,50);
  return decodeGisReadinessPage(await call(client,"staff_gis_readiness",{
    p_site_id:parseGisBigintId(args.siteId,"siteId"),p_area_id:parseGisBigintId(args.areaId,"areaId"),p_page:page,p_page_size:pageSize,
  }));
}

export async function getAdminMappingRelease(client:SupabaseClient<Database>,args:{
  releaseId:string; layer:AdminMappingLayer; page?:number; pageSize?:number;
}):Promise<AdminMappingReleasePage>{
  return decodeAdminMappingReleasePage(await call(client,"staff_mapping_release",{
    p_release_id:parseGisUuid(args.releaseId,"releaseId"),p_layer:args.layer,p_page:parseGisPage(args.page??1),
    p_page_size:parseGisPageSize(args.pageSize??50,200),
  }));
}

export async function getPublicMappingLayer(client:SupabaseClient<Database>,args:{
  siteId:string; areaId:string; layer:PublicMappingLayer; page?:number; pageSize?:number; expectedReleaseId?:string|null;
}):Promise<PublicMappingPage>{
  return decodePublicMappingPage(await call(client,"public_mapping_layer",{
    p_site_id:parseGisBigintId(args.siteId,"siteId"),p_area_id:parseGisBigintId(args.areaId,"areaId"),p_layer:args.layer,
    p_page:parseGisPage(args.page??1),p_page_size:parseGisPageSize(args.pageSize??100,200),
    p_expected_release_id:args.expectedReleaseId==null?null:parseGisUuid(args.expectedReleaseId,"expectedReleaseId"),
  }));
}

export async function getPublicBurialGis(client:SupabaseClient<Database>,burialId:string):Promise<PublicBurialGis|null>{
  return decodePublicBurialGis(await call(client,"public_burial_gis",{p_burial_id:parseGisBigintId(burialId,"burialId")}));
}
