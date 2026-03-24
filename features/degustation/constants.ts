/**
 * Hauteur utile pour le contenu dégustation dans <main> :
 * 100dvh − header (h-14) − pt-8 − pb-16 — plein écran pro.
 */
export const DEGUST_MAIN_VIEWPORT =
  "h-[calc(100dvh-3.5rem-2rem-4rem)] max-h-[calc(100dvh-3.5rem-2rem-4rem)]";

/** Shell plein écran pour le parcours dégustation interactive. */
export const TASTING_SHELL_CLASS = `${DEGUST_MAIN_VIEWPORT} flex min-h-0 w-full flex-col overflow-hidden`;
