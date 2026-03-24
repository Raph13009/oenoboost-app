/**
 * Styles alignés sur les cartes cépages (blanc / rouge) + variantes rosé, champagne, doux, macération.
 * L’index 0..5 boucle avec % 6 si plus de 6 entrées.
 */
export type VinificationCardVariant = {
  card: string;
  iconWrap: string;
};

export const VINIFICATION_CARD_VARIANTS: readonly VinificationCardVariant[] = [
  {
    card:
      "border-black/[0.08] bg-[#FDFCFA] hover:bg-[#F7F5F2] border-[1.5px]",
    iconWrap: "text-[#8A7968] transition-colors duration-200 group-hover:text-[#756555]",
  },
  {
    card:
      "border-[#E8B4B4]/55 bg-[#FDF5F5] hover:bg-[#FAECEC] border-[1.5px]",
    iconWrap: "text-[#C47B7B] transition-colors duration-200 group-hover:text-[#A85F5F]",
  },
  {
    card:
      "border-[#C99595]/65 bg-[#F3E4E4] hover:bg-[#E9D4D4] border-[1.5px]",
    iconWrap: "text-wine transition-colors duration-200 group-hover:opacity-90",
  },
  {
    card:
      "border-[#D4C4A8]/60 bg-[#FBF8F0] hover:bg-[#F3EDE0] border-[1.5px]",
    iconWrap: "text-[#9A8B6E] transition-colors duration-200 group-hover:text-[#7D6F58]",
  },
  {
    card:
      "border-[#D4B896]/50 bg-[#FFF9F2] hover:bg-[#FFF0E5] border-[1.5px]",
    iconWrap: "text-[#A67C52] transition-colors duration-200 group-hover:text-[#8B6540]",
  },
  {
    card:
      "border-[#7C2736]/22 bg-[#F8ECEF] hover:bg-[#F0DEE3] border-[1.5px]",
    iconWrap: "text-wine transition-colors duration-200 group-hover:opacity-90",
  },
] as const;

export function getVinificationVariant(index: number): VinificationCardVariant {
  return VINIFICATION_CARD_VARIANTS[index % VINIFICATION_CARD_VARIANTS.length]!;
}
