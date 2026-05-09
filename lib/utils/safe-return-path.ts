const PLACEHOLDER_ORIGIN = "http://safe-return-path.invalid";

function parseSamePathOnly(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  if (!url.pathname.startsWith("/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  // Reject protocol-relative ("//x") or backslash variants browsers may normalize.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  // Reject embedded control characters that can confuse URL parsers.
  if (/[\x00-\x1f\x7f]/.test(value)) return null;
  return parseSamePathOnly(value);
}

export function safeReturnPathOr(
  value: string | null | undefined,
  fallback: string,
): string {
  return safeReturnPath(value) ?? fallback;
}
