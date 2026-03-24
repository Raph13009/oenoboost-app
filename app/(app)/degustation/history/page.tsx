import { TastingHistoryCard } from "@/features/degustation/components/tasting-history/tasting-history-card";
import { TastingHistoryEmpty } from "@/features/degustation/components/tasting-history/tasting-history-empty";
import { listTastingSheetsForUser } from "@/features/degustation/queries/tasting-sheets.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingHistory.title} — OenoBoost`,
  };
}

export default async function TastingHistoryPage() {
  const user = await requireUser();
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const h = dict.tastingHistory;

  const rows = await listTastingSheetsForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {h.title}
        </h1>
        <p className="text-sm text-muted-foreground">{h.subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <TastingHistoryEmpty labels={h} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <TastingHistoryCard row={row} h={h} locale={user.locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
