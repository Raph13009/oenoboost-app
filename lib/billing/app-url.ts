/**
 * Public origin for Stripe redirect URLs (success / cancel).
 * Set `NEXT_PUBLIC_APP_URL` in production (e.g. https://www.oenoboost.com).
 */
export function getAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    if (vercel.startsWith("http://") || vercel.startsWith("https://")) {
      return vercel.replace(/\/$/, "");
    }
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
