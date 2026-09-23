// Keep only opaque request IDs and hashes in session storage, never form values.
// Receipts expire after a day and are removed once the server confirms success.
type Receipt = { id: string; createdAt: number };
const storageKey = "gravenav.pending-mutations.v1";
const memory = new Map<string, Receipt>();
const maxAge = 24 * 60 * 60 * 1000;
function readReceipts() {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    if (stored && typeof stored === "object") for (const [hash, value] of Object.entries(stored)) {
      if (/^[a-f0-9]{64}$/.test(hash) && value && typeof value === "object" && "id" in value && "createdAt" in value &&
        typeof value.id === "string" && /^[a-f0-9-]{36}$/.test(value.id) && typeof value.createdAt === "number") {
        memory.set(hash, value as Receipt);
      }
    }
  } catch { /* Disabled browser storage still permits safe retries in memory. */ }
  for (const [hash, receipt] of memory) if (Date.now() - receipt.createdAt > maxAge) memory.delete(hash);
}
function persist() {
  while (memory.size > 100) memory.delete(memory.keys().next().value!);
  try { sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(memory))); } catch { /* Storage is optional. */ }
}
export async function mutationFingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function pendingRequestId(hash: string) {
  readReceipts();
  if (!memory.has(hash)) memory.set(hash, { id: crypto.randomUUID(), createdAt: Date.now() });
  persist();
  return memory.get(hash)!.id;
}
export function acknowledgeRequest(hash: string) { memory.delete(hash); persist(); }
