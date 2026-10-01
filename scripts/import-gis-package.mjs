#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { DATA_FILE_NAMES, PACKAGE_LIMITS } from "./gis/package-contract.mjs";
import { validatePackageDirectory } from "./gis/package-validator.mjs";
import {
  createImportClient,
  newOperationId,
  readResumeState,
  redactedLog,
  sha256,
  writeResumeState,
} from "./gis/import-client.mjs";

const MODES = new Set(["stage", "resume", "validate", "finalize", "status"]);

export async function run(argv = process.argv.slice(2), { env = process.env, fetchImpl = globalThis.fetch, stdout = console.log } = {}) {
  const [mode, ...rest] = argv;
  if (!MODES.has(mode) || rest.some((value) => /token|jwt|secret|service.?role/i.test(value))) throw new Error("usage: import-gis-package <stage|resume|validate|finalize|status> [options]");
  const args = parseArgs(rest);
  const resumePath = required(args["resume-file"], "--resume-file");
  const client = createImportClient({ env, fetchImpl });

  if (mode === "stage" || mode === "resume") {
    const directory = resolve(required(args.directory, "--directory"));
    const offline = await validatePackageDirectory(directory);
    stdout(JSON.stringify(offline));
    if (!offline.valid || !offline.requiresDatabaseValidation) throw new Error("offline_package_validation_failed");
    const manifestBytes = await readFile(resolve(directory, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    let state;
    if (mode === "stage") {
      const rootRequestId = randomUUID();
      const begin = await client.begin({
        p_release_id: required(args["release-id"], "--release-id"),
        p_expected_revision: positiveInt(args.revision, "--revision"),
        p_request_id: rootRequestId,
        p_package_digest: offline.packageDigest,
        p_manifest_bytes_base64: manifestBytes.toString("base64"),
      });
      state = { schemaVersion: 1, rootRequestId, importId: begin.importId, releaseId: begin.releaseId,
        packageDigest: offline.packageDigest, baseRevision: begin.baseRevision, targetRevision: begin.targetRevision, chunks: {} };
      await writeResumeState(resumePath, state);
    } else {
      state = await readResumeState(resumePath);
      if (state.packageDigest !== offline.packageDigest) throw new Error("resume_package_digest_mismatch");
    }
    for (const fileName of DATA_FILE_NAMES) {
      const bytes = await readFile(resolve(directory, fileName));
      const declaration = manifest.files.find((file) => file.name === fileName);
      if (!declaration || declaration.sha256 !== sha256(bytes) || declaration.bytes !== bytes.byteLength) throw new Error(`package_changed_after_validation:${fileName}`);
      const received = new Set(state.chunks[fileName] || []);
      for (let offset = 0, index = 0; offset < bytes.length; offset += PACKAGE_LIMITS.maxManifestBytes, index += 1) {
        if (received.has(index)) continue;
        const part = bytes.subarray(offset, Math.min(bytes.length, offset + PACKAGE_LIMITS.maxManifestBytes));
        await client.stageChunk({ p_import_id: state.importId, p_request_id: state.rootRequestId,
          p_package_digest: state.packageDigest, p_expected_revision: state.baseRevision,
          p_file_name: fileName, p_chunk_index: index, p_bytes_base64: part.toString("base64") });
        received.add(index); state.chunks[fileName] = [...received].sort((a, b) => a - b);
        await writeResumeState(resumePath, state);
        stdout(redactedLog("chunk_staged", { mode, importId: state.importId, fileName, chunkIndex: index }));
      }
    }
    state.sealOperationId ||= newOperationId();
    await writeResumeState(resumePath, state);
    const sealed = await client.seal({ p_import_id: state.importId, p_expected_revision: state.baseRevision,
      p_request_id: state.rootRequestId, p_operation_id: state.sealOperationId });
    stdout(redactedLog("import_sealed", { mode, state: sealed.state, importId: state.importId, packageDigest: state.packageDigest }));
    return sealed;
  }

  const state = await readResumeState(resumePath);
  if (mode === "status") {
    const status = await client.status({ p_import_id: state.importId, p_report_page: 1, p_report_page_size: 200 });
    stdout(redactedLog("import_status", { mode, state: status.state, importId: state.importId, packageDigest: state.packageDigest, reportDigest: status.report?.reportHash }));
    return status;
  }
  if (mode === "validate") {
    state.validationOperationId = newOperationId();
    await writeResumeState(resumePath, state);
    const result = await client.validate({ p_import_id: state.importId, p_expected_revision: state.targetRevision,
      p_request_id: state.rootRequestId, p_operation_id: state.validationOperationId });
    state.reportDigest = result.reportDigest; state.reportId = result.reportId;
    await writeResumeState(resumePath, state);
    stdout(redactedLog("import_validated", { mode, state: result.state, importId: state.importId, reportDigest: result.reportDigest }));
    return result;
  }
  state.finalizationOperationId = newOperationId();
  await writeResumeState(resumePath, state);
  const acknowledgements = JSON.parse(await readFile(resolve(required(args.acknowledgements, "--acknowledgements")), "utf8"));
  const reportDigest = args["report-digest"] || state.reportDigest;
  if (!/^[0-9a-f]{64}$/.test(reportDigest || "")) throw new Error("invalid_report_digest");
  const result = await client.finalize({ p_import_id: state.importId, p_expected_revision: state.targetRevision,
    p_report_digest: reportDigest, p_acknowledgements: acknowledgements,
    p_request_id: state.rootRequestId, p_operation_id: state.finalizationOperationId });
  stdout(redactedLog("import_finalized", { mode, state: result.state, importId: state.importId, reportDigest }));
  return result;
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    if (!key?.startsWith("--") || values[index + 1] === undefined) throw new Error("invalid_cli_option");
    result[key.slice(2)] = values[index + 1];
  }
  return result;
}

function required(value, name) { if (!value) throw new Error(`missing ${name}`); return value; }
function positiveInt(value, name) { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`invalid ${name}`); return parsed; }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => { console.error(JSON.stringify({ event: "import_failed", code: String(error.message).replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED]") })); process.exitCode = 1; });
}
