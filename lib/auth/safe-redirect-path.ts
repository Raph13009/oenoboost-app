/**
 * Returns a safe same-origin path for post-login redirect, or null.
 * Rejects open redirects (protocol, //, etc.).
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
): string | null {
  if (next == null || typeof next !== "string") return null;
  const t = next.trim();
  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null;
  if (t.includes("\\")) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("/http") || lower.includes("://")) return null;
  return t;
}
