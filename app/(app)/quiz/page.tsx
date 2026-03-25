import { QuizPageClient } from "@/features/quiz/components/quiz-page-client";
import { getQuizCatalogSummariesForUser } from "@/features/quiz/queries/quiz.queries";
import { requireUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  return {
    title: `${dict.quiz.title} — OenoBoost`,
    description: dict.quiz.subtitle,
  };
}

export default async function QuizPage() {
  const user = await requireUser();

  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const catalog = await getQuizCatalogSummariesForUser(user.id);

  return (
    <QuizPageClient
      catalog={catalog}
      copy={{
        title: dict.quiz.title,
        subtitle: dict.quiz.subtitle,
        startLabel: dict.quiz.start,
        validating: dict.quiz.validating,
        validate: dict.quiz.validate,
        next: dict.quiz.next,
        resultButton: dict.quiz.resultButton,
        restart: dict.quiz.restart,
        back: dict.quiz.back,
        close: dict.common.close,
        unavailable: dict.quiz.unavailable,
        questionsLabel: dict.quiz.questions,
        historyButton: dict.quiz.historyButton,
        lastPlayedLabel: dict.quiz.lastPlayedLabel,
        neverPlayedLabel: dict.quiz.neverPlayedLabel,
        replay: dict.quiz.replay,
        stateAvailable: dict.quiz.stateAvailable,
        stateReplay: dict.quiz.stateReplay,
        stateUnavailable: dict.quiz.stateUnavailable,
        progress: dict.quiz.progress,
        scoreLabel: dict.quiz.scoreLabel,
        percentageLabel: dict.quiz.percentageLabel,
        correctTitle: dict.quiz.correctTitle,
        wrongTitle: dict.quiz.wrongTitle,
        correctAnswerLabel: dict.quiz.correctAnswerLabel,
        explanationLabel: dict.quiz.explanationLabel,
        loadingError: dict.quiz.loadingError,
        resultMessages: dict.quiz.resultMessages,
        levels: dict.quiz.levels,
      }}
    />
  );
}
