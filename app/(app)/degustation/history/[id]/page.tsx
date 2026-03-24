import { notFound } from "next/navigation";

import { TastingSheetDetail } from "@/features/degustation/components/tasting-history/tasting-sheet-detail";
import { getTastingSheetByIdForUser } from "@/features/degustation/queries/tasting-sheets.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingHistory.title} — OenoBoost`,
  };
}

export default async function TastingHistoryDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const dict = await getDictionary(await getServerLocale());

  const sheet = await getTastingSheetByIdForUser(id, user.id);
  if (!sheet) notFound();

  return (
    <TastingSheetDetail
      sheet={sheet}
      h={dict.tastingHistory}
      flow={dict.tastingFlow}
      locale={user.locale}
    />
  );
}
