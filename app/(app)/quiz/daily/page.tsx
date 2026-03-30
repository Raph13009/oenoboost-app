import { DailyQuestionClient } from "@/features/quiz/components/daily-question-client";
import { getDailyQuestionForUser } from "@/features/quiz/queries/daily-question.queries";
import { requireUser } from "@/lib/auth/session";
import { isPremiumPlan } from "@/lib/favorites/constants";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export default async function DailyQuestionPage() {
  const user = await requireUser();
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const daily = await getDailyQuestionForUser({
    userId: user.id,
    locale,
    isPremium: isPremiumPlan(user.plan),
  });

  if (!daily.questionId) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{dict.common.empty}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <DailyQuestionClient
        questionId={daily.questionId}
        prompt={daily.prompt}
        copy={{
          trueLabel: dict.home.dailyTrueLabel,
          falseLabel: dict.home.dailyFalseLabel,
          explanationLabel: dict.quiz.explanationLabel,
          correctTitle: dict.quiz.correctTitle,
          wrongTitle: dict.quiz.wrongTitle,
        }}
      />
    </div>
  );
}

