import { QuizHistoryPageClient } from "@/features/quiz/components/quiz-history-page-client";
import { getRecentQuizHistoryForUser } from "@/features/quiz/queries/quiz.queries";
import { requireUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  return {
    title: `${dict.quiz.historyTitle} — OenoBoost`,
  };
}

export default async function QuizHistoryPage() {
  const user = await requireUser();
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const history = await getRecentQuizHistoryForUser(user.id, locale, 20);

  return (
    <QuizHistoryPageClient
      history={history}
      copy={{
        title: dict.quiz.historyTitle,
        empty: dict.quiz.historyEmpty,
        replay: dict.quiz.replay,
        back: dict.quiz.back,
      }}
    />
  );
}

