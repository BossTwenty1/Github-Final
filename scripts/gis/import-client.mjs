import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RPC_NAMES = Object.freeze({
  begin: "staff_begin_mapping_import",
  chunk: "staff_stage_mapping_import_chunk",
  seal: "staff_seal_mapping_import",
  validate: "staff_validate_mapping_import",
  finalize: "staff_finalize_mapping_import",
  status: "staff_mapping_import_status",
});

export function createImportClient({ env = process.env, fetchImpl = globalThis.fetch, maxAttempts = 3 } = {}) {
  const url = required(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = required(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const token = required(env.GRAVENAV_GIS_ACCESS_TOKEN, "GRAVENAV_GIS_ACCESS_TOKEN");
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error("invalid_retry_bound");

  async function rpc(name, body) {
    if (!Object.values(RPC_NAMES).includes(name)) throw new Error("unsupported_rpc");
    let last;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await response.text();
        if (response.ok) return text.length ? JSON.parse(text) : null;
        last = new Error(`rpc_${name}_failed_${response.status}`);
        if (!TRANSIENT_STATUS.has(response.status) || attempt === maxAttempts) throw last;
      } catch (error) {
        last = redactError(error);
        if (attempt === maxAttempts || /^rpc_.*_failed_(4(?!08|25|29)\d\d)$/.test(last.message)) throw last;
      }
    }
    throw last ?? new Error(`rpc_${name}_failed`);
  }

  return Object.freeze({
    begin: (values) => rpc(RPC_NAMES.begin, values),
    stageChunk: (values) => rpc(RPC_NAMES.chunk, values),
    seal: (values) => rpc(RPC_NAMES.seal, values),
    validate: (values) => rpc(RPC_NAMES.validate, values),
    finalize: (values) => rpc(RPC_NAMES.finalize, values),
    status: (values) => rpc(RPC_NAMES.status, values),
  });
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function newOperationId() {
  return randomUUID();
}

export async function readResumeState(path) {
  const value = JSON.parse(await readFile(path, "utf8"));
  assertResumeState(value);
  return value;
}

export async function writeResumeState(path, value) {
  assertResumeState(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "w", mode: 0o600 });
}

export function assertResumeState(value) {
  const allowed = new Set([
    "schemaVersion", "rootRequestId", "importId", "releaseId", "packageDigest", "baseRevision",
    "targetRevision", "sealOperationId", "validationOperationId", "finalizationOperationId", "chunks",
    "reportDigest", "reportId",
  ]);
  if (!plain(value) || value.schemaVersion !== 1 || Object.keys(value).some((key) => !allowed.has(key))) throw new Error("invalid_resume_state");
  for (const key of ["rootRequestId", "importId", "releaseId", "packageDigest"]) if (typeof value[key] !== "string") throw new Error("invalid_resume_state");
  if (!plain(value.chunks)) throw new Error("invalid_resume_state");
  for (const [name, indexes] of Object.entries(value.chunks)) {
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(name) || !Array.isArray(indexes) || indexes.some((index) => !Number.isInteger(index) || index < 0 || index > 63)) throw new Error("invalid_resume_state");
  }
  const serialized = JSON.stringify(value).toLowerCase();
  if (/access_token|authorization|bearer|service_role|secret_key|raw_bytes|bytes_base64|jwt/.test(serialized)) throw new Error("credential_or_raw_bytes_forbidden_in_resume_state");
}

export function redactedLog(event, fields = {}) {
  const safe = {};
  for (const key of ["mode", "state", "importId", "releaseId", "packageDigest", "reportDigest", "fileName", "chunkIndex", "attempt"]) {
    if (fields[key] !== undefined) safe[key] = fields[key];
  }
  return JSON.stringify({ event, ...safe });
}

function required(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`missing_${name}`);
  return value;
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function redactError(error) {
  const message = String(error?.message || "rpc_failed").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED]");
  return new Error(message);
}
