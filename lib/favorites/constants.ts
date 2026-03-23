/** Max favoris (cépages + AOP confondus) pour les comptes non premium. */
export const MAX_FREE_FAVORITES = 3;

export function isPremiumPlan(plan: string | null | undefined): boolean {
  return String(plan ?? "").toLowerCase() === "premium";
}
