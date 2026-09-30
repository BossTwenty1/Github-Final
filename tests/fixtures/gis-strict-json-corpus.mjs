const utf8 = (value) => Buffer.from(value, "utf8");

export const GIS_STRICT_JSON_CORPUS = Object.freeze([
  { name: "simple object", valid: true, bytes: utf8('{"value":1}') },
  { name: "same key in separate objects", valid: true, bytes: utf8('[{"x":1},{"x":2}]') },
  { name: "decoded duplicate key", valid: false, bytes: utf8('{"a":1,"\\u0061":2}') },
  { name: "nested duplicate key", valid: false, bytes: utf8('{"outer":{"x":1,"x":2}}') },
  { name: "malformed trailing comma", valid: false, bytes: utf8('{"a":1,}') },
  { name: "invalid UTF-8", valid: false, bytes: Buffer.from([0xc3, 0x28]) },
  { name: "UTF-8 BOM", valid: false, bytes: Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]) },
  { name: "nonfinite numeric result", valid: false, bytes: utf8('{"n":1e9999}') },
  { name: "unpaired surrogate", valid: false, bytes: utf8('{"s":"\\uD800"}') },
  { name: "excessive nesting", valid: false, bytes: utf8(`${"[".repeat(34)}0${"]".repeat(34)}`) },
  { name: "oversized string", valid: false, bytes: utf8(`{"s":"${"x".repeat(8_193)}"}`) },
]);
