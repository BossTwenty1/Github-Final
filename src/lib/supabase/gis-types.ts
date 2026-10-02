const MAX_BIGINT_ID = BigInt("9223372036854775807");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GisBigintId = string;
export type GisReadinessReason =
  | "lot_removed"
  | "no_published_release"
  | "no_approved_polygon"
  | "no_access_point"
  | "unreviewed_access_point"
  | "unreachable"
  | null;
export type GisOccupancy = "occupied" | "booked" | "hold" | "available";
export type LegacyCoordinateState = "missing" | "pending" | "verified" | "rejected";
export type PublicMappingLayer = "boundaries" | "plots" | "access_points" | "walkways" | "nodes" | "edges" | "landmarks";
export type AdminMappingLayer = "metadata" | PublicMappingLayer;
export type ContentAuthority = "none" | "retained_unapproved" | "current_validated" | "frozen";

export interface GisReadinessRow {
  lotId: GisBigintId;
  lotCode: string;
  areaId: GisBigintId;
  occupancy: GisOccupancy;
  legacyCoordinate: LegacyCoordinateState;
  geometryReady: boolean;
  routingReady: boolean;
  reason: GisReadinessReason;
}

export interface GisReadinessPage {
  schemaVersion: 1;
  siteId: GisBigintId;
  areaId: GisBigintId;
  releaseId: string | null;
  scopeRevision: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { geometryReady: number; routingReady: number; legacyMissing: number };
  rows: GisReadinessRow[];
}

export interface GeoJsonGeometry {
  type: "Point" | "LineString" | "Polygon";
  coordinates: unknown[];
}

export interface PublicGisFeature {
  type: "Feature";
  id: string;
  geometry: GeoJsonGeometry;
  properties: Record<string, string | number | boolean | null>;
}

export interface PublicMappingPage {
  schemaVersion: 1;
  releaseId: string | null;
  scopeRevision: number;
  layer: PublicMappingLayer;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  features: PublicGisFeature[];
}

export interface PublicBurialGis {
  schemaVersion: 1;
  burialId: GisBigintId;
  lotId: GisBigintId;
  lotCode: string;
  areaId: GisBigintId;
  releaseId: string | null;
  geometryReady: boolean;
  routingReady: boolean;
  reason: GisReadinessReason;
  plotGeometry: GeoJsonGeometry | null;
  accessPoint: GeoJsonGeometry | null;
}

export interface AdminMappingReleasePage {
  schemaVersion: 1;
  release: AdminMappingRelease;
  contentAuthority: ContentAuthority;
  layer: AdminMappingLayer;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: AdminMappingRow[];
}

export interface AdminMappingRelease {
  id:string; siteId:GisBigintId; releaseCode:string; title:string; description:string|null;
  scopeKind:"pilot"|"full"; pilotAreaId:GisBigintId|null; status:string; revision:number;
  packageReference:string|null; packageHash:string|null; sourcePlanReference:string|null;
  sourcePlanVersion:string|null; sourcePlanHash:string|null; sourceCoordinateSpace:string|null;
  fieldSrid:number; workingSrid:number; publishedSrid:number; qgisVersion:string|null;
  selectedRunId:string|null; validationReportHash:string|null; validationSummary:Record<string,unknown>|null;
  notes:string|null; rejectionReason:string|null;
}

export type AdminMappingRow = Record<string, unknown> & { authoritative:boolean };

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unsupported field ${key}`);
  for (const key of keys) if (!(key in value)) throw new Error(`${label} is missing ${key}`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a nonempty string`);
  return value;
}

function nullableText(value:unknown,label:string):string|null {
  if(value===null) return null;
  return text(value,label);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !globalThis.Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a safe nonnegative integer`);
  return value;
}

function positiveInteger(value:unknown,label:string):number {
  const result=integer(value,label);
  if(result<1) throw new Error(`${label} must be positive`);
  return result;
}

function finiteNumber(value:unknown,label:string,nullable=false):number|null {
  if(value===null && nullable) return null;
  if(typeof value!=="number" || !globalThis.Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function sha256(value:unknown,label:string,nullable=false):string|null {
  if(value===null && nullable) return null;
  const result=text(value,label);
  if(!/^[0-9a-f]{64}$/.test(result)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
  return result;
}

function oneOf<T extends string>(value:unknown,allowed:readonly T[],label:string):T {
  if(typeof value!=="string" || !allowed.includes(value as T)) throw new Error(`${label} is unsupported`);
  return value as T;
}

function nullableUuid(value: unknown, label: string): string | null {
  if (value === null) return null;
  const result = text(value, label);
  if (!UUID.test(result)) throw new Error(`${label} must be a UUID`);
  return result;
}

export function parseGisBigintId(value: unknown, label = "id"): GisBigintId {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)) {
    throw new Error(`${label} must be a positive decimal-string ID`);
  }
  if (BigInt(value) > MAX_BIGINT_ID) throw new Error(`${label} is outside the PostgreSQL bigint range`);
  return value;
}

export function parseGisPage(value: unknown, label = "page", maximum = 100000): number {
  const result = integer(value, label);
  if (result < 1 || result > maximum) throw new Error(`${label} is outside the supported bound`);
  return result;
}

export function parseGisPageSize(value: unknown, maximum: number): number {
  return parseGisPage(value, "pageSize", maximum);
}

export function parseGisUuid(value: unknown, label: string): string {
  const result = nullableUuid(value, label);
  if (result === null) throw new Error(`${label} is required`);
  return result;
}

function readinessReason(value: unknown): GisReadinessReason {
  if (value === null) return null;
  if (!["lot_removed","no_published_release","no_approved_polygon","no_access_point","unreviewed_access_point","unreachable"].includes(String(value))) {
    throw new Error("reason is unsupported");
  }
  return value as Exclude<GisReadinessReason, null>;
}

function geometry(value: unknown, label: string): GeoJsonGeometry {
  const row = object(value,label);
  exact(row,["type","coordinates"],label);
  if (!["Point","LineString","Polygon"].includes(String(row.type)) || !Array.isArray(row.coordinates)) throw new Error(`${label} is invalid GeoJSON`);
  return row as unknown as GeoJsonGeometry;
}

function nullableGeometry(value:unknown,label:string):GeoJsonGeometry|null {
  return value===null?null:geometry(value,label);
}

export function decodeGisReadinessPage(value: unknown): GisReadinessPage {
  const row=object(value,"readiness");
  exact(row,["schemaVersion","siteId","areaId","releaseId","scopeRevision","page","pageSize","total","totalPages","counts","rows"],"readiness");
  if(row.schemaVersion!==1) throw new Error("readiness schemaVersion is unsupported");
  const counts=object(row.counts,"readiness.counts"); exact(counts,["geometryReady","routingReady","legacyMissing"],"readiness.counts");
  if(!Array.isArray(row.rows)) throw new Error("readiness.rows must be an array");
  const rows=row.rows.map((item,index)=>{
    const entry=object(item,`readiness.rows[${index}]`);
    exact(entry,["lotId","lotCode","areaId","occupancy","legacyCoordinate","geometryReady","routingReady","reason"],`readiness.rows[${index}]`);
    if(!["occupied","booked","hold","available"].includes(String(entry.occupancy))) throw new Error("occupancy is unsupported");
    if(!["missing","pending","verified","rejected"].includes(String(entry.legacyCoordinate))) throw new Error("legacyCoordinate is unsupported");
    return { lotId:parseGisBigintId(entry.lotId,"lotId"),lotCode:text(entry.lotCode,"lotCode"),areaId:parseGisBigintId(entry.areaId,"areaId"),
      occupancy:entry.occupancy as GisOccupancy,legacyCoordinate:entry.legacyCoordinate as LegacyCoordinateState,
      geometryReady:bool(entry.geometryReady,"geometryReady"),routingReady:bool(entry.routingReady,"routingReady"),reason:readinessReason(entry.reason) };
  });
  return {schemaVersion:1,siteId:parseGisBigintId(row.siteId,"siteId"),areaId:parseGisBigintId(row.areaId,"areaId"),
    releaseId:nullableUuid(row.releaseId,"releaseId"),scopeRevision:integer(row.scopeRevision,"scopeRevision"),page:parseGisPage(row.page),
    pageSize:parseGisPageSize(row.pageSize,50),total:integer(row.total,"total"),totalPages:integer(row.totalPages,"totalPages"),
    counts:{geometryReady:integer(counts.geometryReady,"geometryReady"),routingReady:integer(counts.routingReady,"routingReady"),legacyMissing:integer(counts.legacyMissing,"legacyMissing")},rows};
}

const PUBLIC_LAYERS: PublicMappingLayer[]=["boundaries","plots","access_points","walkways","nodes","edges","landmarks"];
const PUBLIC_PROPERTY_KEYS: Record<PublicMappingLayer,readonly string[]>={
  boundaries:["sourceFeatureId","kind","areaId"],plots:["sourceFeatureId","lotId","lotCode","areaId"],
  access_points:["sourceFeatureId","lotId","areaId","nodeId"],walkways:["sourceFeatureId","areaId","walkwayType","walkingAllowed"],
  nodes:["sourceFeatureId","nodeId","name","nodeType"],edges:["sourceFeatureId","edgeId","fromNodeId","toNodeId","direction","forwardCostM","reverseCostM","edgeType"],
  landmarks:["sourceFeatureId","kind","label","routeNodeId"],
};

export function decodePublicMappingPage(value: unknown): PublicMappingPage {
  const row=object(value,"mapping layer"); exact(row,["schemaVersion","releaseId","scopeRevision","layer","page","pageSize","total","totalPages","features"],"mapping layer");
  if(row.schemaVersion!==1 || !PUBLIC_LAYERS.includes(row.layer as PublicMappingLayer)) throw new Error("mapping layer contract is unsupported");
  if(!Array.isArray(row.features)) throw new Error("features must be an array");
  const layer=row.layer as PublicMappingLayer;
  const features=row.features.map((item,index)=>{
    const feature=object(item,`features[${index}]`); exact(feature,["type","id","geometry","properties"],`features[${index}]`);
    if(feature.type!=="Feature") throw new Error("feature type is invalid");
    const properties=object(feature.properties,"feature.properties"); exact(properties,PUBLIC_PROPERTY_KEYS[layer],"feature.properties");
    const safe:PublicGisFeature["properties"]={sourceFeatureId:text(properties.sourceFeatureId,"sourceFeatureId")};
    if(layer==="boundaries") {
      safe.kind=oneOf(properties.kind,["cemetery","area"],"kind");
      safe.areaId=properties.areaId===null?null:parseGisBigintId(properties.areaId,"areaId");
    } else if(layer==="plots") {
      safe.lotId=parseGisBigintId(properties.lotId,"lotId"); safe.lotCode=text(properties.lotCode,"lotCode");
      safe.areaId=parseGisBigintId(properties.areaId,"areaId");
    } else if(layer==="access_points") {
      safe.lotId=parseGisBigintId(properties.lotId,"lotId"); safe.areaId=parseGisBigintId(properties.areaId,"areaId");
      safe.nodeId=parseGisBigintId(properties.nodeId,"nodeId");
    } else if(layer==="walkways") {
      safe.areaId=parseGisBigintId(properties.areaId,"areaId"); safe.walkwayType=oneOf(properties.walkwayType,["road","path","entrance"],"walkwayType");
      safe.walkingAllowed=bool(properties.walkingAllowed,"walkingAllowed");
    } else if(layer==="nodes") {
      safe.nodeId=parseGisBigintId(properties.nodeId,"nodeId"); safe.name=text(properties.name,"name");
      safe.nodeType=oneOf(properties.nodeType,["entrance","junction","landmark"],"nodeType");
    } else if(layer==="edges") {
      safe.edgeId=parseGisBigintId(properties.edgeId,"edgeId"); safe.fromNodeId=parseGisBigintId(properties.fromNodeId,"fromNodeId");
      safe.toNodeId=parseGisBigintId(properties.toNodeId,"toNodeId"); safe.direction=oneOf(properties.direction,["both","forward","reverse"],"direction");
      safe.forwardCostM=finiteNumber(properties.forwardCostM,"forwardCostM",true); safe.reverseCostM=finiteNumber(properties.reverseCostM,"reverseCostM",true);
      safe.edgeType=oneOf(properties.edgeType,["path","road","entrance"],"edgeType");
    } else {
      safe.kind=oneOf(properties.kind,["landmark","building","entrance"],"kind"); safe.label=text(properties.label,"label");
      safe.routeNodeId=properties.routeNodeId===null?null:parseGisBigintId(properties.routeNodeId,"routeNodeId");
    }
    return {type:"Feature" as const,id:text(feature.id,"feature.id"),geometry:geometry(feature.geometry,"feature.geometry"),properties:safe};
  });
  return {schemaVersion:1,releaseId:nullableUuid(row.releaseId,"releaseId"),scopeRevision:integer(row.scopeRevision,"scopeRevision"),layer,
    page:parseGisPage(row.page),pageSize:parseGisPageSize(row.pageSize,200),total:integer(row.total,"total"),totalPages:integer(row.totalPages,"totalPages"),features};
}

export function decodePublicBurialGis(value: unknown): PublicBurialGis | null {
  if(value===null) return null;
  const row=object(value,"burial GIS"); exact(row,["schemaVersion","burialId","lotId","lotCode","areaId","releaseId","geometryReady","routingReady","reason","plotGeometry","accessPoint"],"burial GIS");
  if(row.schemaVersion!==1) throw new Error("burial GIS schemaVersion is unsupported");
  return {schemaVersion:1,burialId:parseGisBigintId(row.burialId,"burialId"),lotId:parseGisBigintId(row.lotId,"lotId"),
    lotCode:text(row.lotCode,"lotCode"),areaId:parseGisBigintId(row.areaId,"areaId"),releaseId:nullableUuid(row.releaseId,"releaseId"),
    geometryReady:bool(row.geometryReady,"geometryReady"),routingReady:bool(row.routingReady,"routingReady"),reason:readinessReason(row.reason),
    plotGeometry:row.plotGeometry===null?null:geometry(row.plotGeometry,"plotGeometry"),accessPoint:row.accessPoint===null?null:geometry(row.accessPoint,"accessPoint")};
}

const ADMIN_PROVENANCE_KEYS=["reviewState","revision","artifactHash","layerName","layerVersion","authoritative"] as const;

function adminProvenance(entry:Record<string,unknown>):Record<string,unknown>&{authoritative:boolean} {
  return {
    reviewState:oneOf(entry.reviewState,["pending","approved","rejected"],"reviewState"),
    revision:positiveInteger(entry.revision,"revision"),artifactHash:sha256(entry.artifactHash,"artifactHash"),
    layerName:text(entry.layerName,"layerName"),layerVersion:text(entry.layerVersion,"layerVersion"),
    authoritative:bool(entry.authoritative,"authoritative"),
  };
}

function decodeAdminRow(value:unknown,layer:AdminMappingLayer,label:string):AdminMappingRow {
  const entry=object(value,label);
  if(layer==="metadata") { exact(entry,[],label); throw new Error("metadata rows must be empty"); }
  const privateKey=layer==="nodes"||layer==="edges"?"reviewNotes":"privateNotes";
  let layerKeys:readonly string[];
  if(layer==="boundaries") layerKeys=["id","sourceFeatureId","kind","areaId","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else if(layer==="plots") layerKeys=["id","sourceFeatureId","lotId","areaId","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else if(layer==="access_points") layerKeys=["id","sourceFeatureId","lotId","areaId","nodeId","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else if(layer==="walkways") layerKeys=["id","sourceFeatureId","areaId","walkwayType","walkingAllowed","restrictionContext","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else if(layer==="nodes") layerKeys=["id","sourceFeatureId","name","nodeType","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else if(layer==="edges") layerKeys=["id","sourceFeatureId","fromNodeId","toNodeId","direction","forwardCostM","reverseCostM","walkingAllowed","restricted","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  else layerKeys=["id","sourceFeatureId","kind","label","routeNodeId","geometry",...ADMIN_PROVENANCE_KEYS,privateKey];
  exact(entry,layerKeys,label);
  const safe:AdminMappingRow={sourceFeatureId:text(entry.sourceFeatureId,"sourceFeatureId"),...adminProvenance(entry),
    [privateKey]:nullableText(entry[privateKey],privateKey)};
  if(layer==="nodes"||layer==="edges") safe.id=parseGisBigintId(entry.id,"id");
  else safe.id=parseGisUuid(entry.id,"id");
  safe.geometry=nullableGeometry(entry.geometry,"geometry");
  if(layer==="boundaries") {
    safe.kind=oneOf(entry.kind,["cemetery","area"],"kind"); safe.areaId=entry.areaId===null?null:parseGisBigintId(entry.areaId,"areaId");
  } else if(layer==="plots") {
    safe.lotId=parseGisBigintId(entry.lotId,"lotId"); safe.areaId=parseGisBigintId(entry.areaId,"areaId");
  } else if(layer==="access_points") {
    safe.lotId=parseGisBigintId(entry.lotId,"lotId"); safe.areaId=parseGisBigintId(entry.areaId,"areaId"); safe.nodeId=parseGisBigintId(entry.nodeId,"nodeId");
  } else if(layer==="walkways") {
    safe.areaId=parseGisBigintId(entry.areaId,"areaId"); safe.walkwayType=oneOf(entry.walkwayType,["road","path","entrance"],"walkwayType");
    safe.walkingAllowed=bool(entry.walkingAllowed,"walkingAllowed"); safe.restrictionContext=nullableText(entry.restrictionContext,"restrictionContext");
  } else if(layer==="nodes") {
    safe.name=text(entry.name,"name"); safe.nodeType=oneOf(entry.nodeType,["entrance","junction","landmark"],"nodeType");
  } else if(layer==="edges") {
    safe.fromNodeId=parseGisBigintId(entry.fromNodeId,"fromNodeId"); safe.toNodeId=parseGisBigintId(entry.toNodeId,"toNodeId");
    safe.direction=oneOf(entry.direction,["both","forward","reverse"],"direction"); safe.forwardCostM=finiteNumber(entry.forwardCostM,"forwardCostM",true);
    safe.reverseCostM=finiteNumber(entry.reverseCostM,"reverseCostM",true); safe.walkingAllowed=bool(entry.walkingAllowed,"walkingAllowed");
    safe.restricted=bool(entry.restricted,"restricted");
  } else {
    safe.kind=oneOf(entry.kind,["landmark","building","entrance"],"kind"); safe.label=text(entry.label,"label");
    safe.routeNodeId=entry.routeNodeId===null?null:parseGisBigintId(entry.routeNodeId,"routeNodeId");
  }
  return safe;
}

export function decodeAdminMappingReleasePage(value: unknown): AdminMappingReleasePage {
  const row=object(value,"admin mapping release"); exact(row,["schemaVersion","release","contentAuthority","layer","page","pageSize","total","totalPages","rows"],"admin mapping release");
  if(row.schemaVersion!==1 || !["none","retained_unapproved","current_validated","frozen"].includes(String(row.contentAuthority))) throw new Error("content authority is unsupported");
  if(!["metadata",...PUBLIC_LAYERS].includes(String(row.layer)) || !Array.isArray(row.rows)) throw new Error("admin layer is unsupported");
  const releaseRaw=object(row.release,"release");
  exact(releaseRaw,["id","siteId","releaseCode","title","description","scopeKind","pilotAreaId","status","revision","packageReference","packageHash",
    "sourcePlanReference","sourcePlanVersion","sourcePlanHash","sourceCoordinateSpace","fieldSrid","workingSrid","publishedSrid","qgisVersion",
    "selectedRunId","validationReportHash","validationSummary","notes","rejectionReason"],"release");
  const validationSummary=releaseRaw.validationSummary===null?null:object(releaseRaw.validationSummary,"validationSummary");
  if(validationSummary!==null) {
    exact(validationSummary,["schemaVersion","featureCount","errorCount","warningCount","reportDigest"],"validationSummary");
    if(validationSummary.schemaVersion!==1) throw new Error("validationSummary schemaVersion is unsupported");
    integer(validationSummary.featureCount,"featureCount"); integer(validationSummary.errorCount,"errorCount"); integer(validationSummary.warningCount,"warningCount");
    sha256(validationSummary.reportDigest,"reportDigest");
  }
  const release:AdminMappingRelease={
    id:parseGisUuid(releaseRaw.id,"release.id"),siteId:parseGisBigintId(releaseRaw.siteId,"release.siteId"),
    releaseCode:text(releaseRaw.releaseCode,"releaseCode"),title:text(releaseRaw.title,"title"),description:nullableText(releaseRaw.description,"description"),
    scopeKind:oneOf(releaseRaw.scopeKind,["pilot","full"],"scopeKind"),pilotAreaId:releaseRaw.pilotAreaId===null?null:parseGisBigintId(releaseRaw.pilotAreaId,"pilotAreaId"),
    status:oneOf(releaseRaw.status,["draft","staged","validated","approved","published","superseded","rejected"],"status"),revision:positiveInteger(releaseRaw.revision,"revision"),
    packageReference:nullableText(releaseRaw.packageReference,"packageReference"),packageHash:sha256(releaseRaw.packageHash,"packageHash",true),
    sourcePlanReference:nullableText(releaseRaw.sourcePlanReference,"sourcePlanReference"),sourcePlanVersion:nullableText(releaseRaw.sourcePlanVersion,"sourcePlanVersion"),
    sourcePlanHash:sha256(releaseRaw.sourcePlanHash,"sourcePlanHash",true),sourceCoordinateSpace:nullableText(releaseRaw.sourceCoordinateSpace,"sourceCoordinateSpace"),
    fieldSrid:positiveInteger(releaseRaw.fieldSrid,"fieldSrid"),workingSrid:positiveInteger(releaseRaw.workingSrid,"workingSrid"),
    publishedSrid:positiveInteger(releaseRaw.publishedSrid,"publishedSrid"),qgisVersion:nullableText(releaseRaw.qgisVersion,"qgisVersion"),
    selectedRunId:nullableUuid(releaseRaw.selectedRunId,"selectedRunId"),validationReportHash:sha256(releaseRaw.validationReportHash,"validationReportHash",true),
    validationSummary,notes:nullableText(releaseRaw.notes,"notes"),rejectionReason:nullableText(releaseRaw.rejectionReason,"rejectionReason"),
  };
  const layer=row.layer as AdminMappingLayer;
  const decodedRows=row.rows.map((item,index)=>decodeAdminRow(item,layer,`rows[${index}]`));
  if(layer==="metadata" && decodedRows.length!==0) throw new Error("metadata rows must be empty");
  return {schemaVersion:1,release,contentAuthority:row.contentAuthority as ContentAuthority,layer,
    page:parseGisPage(row.page),pageSize:parseGisPageSize(row.pageSize,200),total:integer(row.total,"total"),totalPages:integer(row.totalPages,"totalPages"),
    rows:decodedRows};
}
