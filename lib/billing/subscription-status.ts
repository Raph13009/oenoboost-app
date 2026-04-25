const PREMIUM_STATUSES = new Set(["active", "trialing"]);

export function isPremiumStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return PREMIUM_STATUSES.has(status);
}
