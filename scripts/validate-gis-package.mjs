#!/usr/bin/env node

import { validatePackageDirectory } from "./gis/package-validator.mjs";

const directory = process.argv[2];
let result;

if (!directory || process.argv.length !== 3) {
  result = {
    schemaVersion: 1,
    valid: false,
    requiresDatabaseValidation: true,
    databaseValidationPerformed: false,
    packageDigest: null,
    fileCount: 15,
    totalBytes: 0,
    counts: {},
    errorCount: 1,
    errorsTruncated: false,
    errors: [{ code: "usage_error" }],
  };
} else {
  try {
    result = await validatePackageDirectory(directory);
  } catch {
    result = {
      schemaVersion: 1,
      valid: false,
      requiresDatabaseValidation: true,
      databaseValidationPerformed: false,
      packageDigest: null,
      fileCount: 15,
      totalBytes: 0,
      counts: {},
      errorCount: 1,
      errorsTruncated: false,
      errors: [{ code: "validator_failure" }],
    };
  }
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.valid ? 0 : 1;
