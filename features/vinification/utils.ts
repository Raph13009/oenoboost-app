export const VINIFICATION_PLACEHOLDER_IMAGE = "/images/vinification-placeholder.jpg";

export function getVinificationIllustrationSrc(url: string | null): string {
  if (url && url.trim().length > 0) {
    return url.trim();
  }
  return VINIFICATION_PLACEHOLDER_IMAGE;
}
