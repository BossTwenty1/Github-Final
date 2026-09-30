const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 32,
  maxNodes: 500_000,
  maxStringLength: 8_192,
});

export class StrictJsonError extends SyntaxError {
  constructor(code) {
    super(code);
    this.name = "StrictJsonError";
    this.code = code;
  }
}

export function parseStrictJson(bytes, limits = {}) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("parseStrictJson expects Uint8Array bytes");
  const effective = { ...DEFAULT_LIMITS, ...limits };
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new StrictJsonError("json_bom");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StrictJsonError("invalid_utf8");
  }
  if (text.charCodeAt(0) === 0xfeff) throw new StrictJsonError("json_bom");

  let index = 0;
  let nodes = 0;

  function fail(code = "malformed_json") {
    throw new StrictJsonError(code);
  }

  function whitespace() {
    while (index < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[index])) index += 1;
  }

  function countNode(depth) {
    nodes += 1;
    if (nodes > effective.maxNodes) fail("json_node_limit_exceeded");
    if (depth > effective.maxDepth) fail("json_depth_exceeded");
  }

  function parseValue(depth) {
    whitespace();
    countNode(depth);
    const token = text[index];
    if (token === "{") return parseObject(depth);
    if (token === "[") return parseArray(depth);
    if (token === '"') return parseString();
    if (token === "t") return parseLiteral("true", true);
    if (token === "f") return parseLiteral("false", false);
    if (token === "n") return parseLiteral("null", null);
    if (token === "-" || (token >= "0" && token <= "9")) return parseNumber();
    fail();
  }

  function parseObject(depth) {
    index += 1;
    whitespace();
    const result = {};
    const keys = new Set();
    if (text[index] === "}") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      whitespace();
      if (text[index] !== '"') fail();
      const key = parseString();
      if (keys.has(key)) fail("duplicate_json_key");
      keys.add(key);
      whitespace();
      if (text[index] !== ":") fail();
      index += 1;
      const value = parseValue(depth + 1);
      Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail();
      index += 1;
    }
    fail();
  }

  function parseArray(depth) {
    index += 1;
    whitespace();
    const result = [];
    if (text[index] === "]") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(parseValue(depth + 1));
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail();
      index += 1;
    }
    fail();
  }

  function parseString() {
    index += 1;
    let result = "";
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') {
        if (result.length > effective.maxStringLength) fail("json_string_limit_exceeded");
        return result;
      }
      if (character === "\\") {
        if (index >= text.length) fail();
        const escape = text[index++];
        if (escape === '"' || escape === "\\" || escape === "/") result += escape;
        else if (escape === "b") result += "\b";
        else if (escape === "f") result += "\f";
        else if (escape === "n") result += "\n";
        else if (escape === "r") result += "\r";
        else if (escape === "t") result += "\t";
        else if (escape === "u") result += parseUnicodeEscape();
        else fail();
      } else {
        if (character.charCodeAt(0) < 0x20) fail();
        result += character;
      }
      if (result.length > effective.maxStringLength) fail("json_string_limit_exceeded");
    }
    fail();
  }

  function parseUnicodeEscape() {
    const first = parseHexCodeUnit();
    if (first >= 0xd800 && first <= 0xdbff) {
      if (text[index] !== "\\" || text[index + 1] !== "u") fail("invalid_unicode_escape");
      index += 2;
      const second = parseHexCodeUnit();
      if (second < 0xdc00 || second > 0xdfff) fail("invalid_unicode_escape");
      return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
    }
    if (first >= 0xdc00 && first <= 0xdfff) fail("invalid_unicode_escape");
    return String.fromCharCode(first);
  }

  function parseHexCodeUnit() {
    const hex = text.slice(index, index + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
    index += 4;
    return Number.parseInt(hex, 16);
  }

  function parseLiteral(literal, value) {
    if (text.slice(index, index + literal.length) !== literal) fail();
    index += literal.length;
    return value;
  }

  function parseNumber() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(index));
    if (!match) fail();
    index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("nonfinite_number");
    return value;
  }

  whitespace();
  if (index >= text.length) fail();
  const value = parseValue(0);
  whitespace();
  if (index !== text.length) fail();
  return value;
}
