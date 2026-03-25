"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { replayQuizAction } from "@/features/quiz/actions/quiz-actions";
import { QUIZ_SHELL_CLASS } from "@/features/quiz/constants";
import type { RecentQuizHistoryItem } from "@/features/quiz/queries/quiz.queries";

type Props = {
  history: RecentQuizHistoryItem[];
  copy: {
    title: string;
    empty: string;
    replay: string;
    back: string;
  };
};

function formatHistoryDate(completedAt: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(completedAt));
  } catch {
    return completedAt;
  }
}

export function QuizHistoryPageClient({ history, copy }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function replayQuiz(quizId: string) {
    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await replayQuizAction(quizId);
        if (!response.ok) {
          setErrorMessage(response.message ?? "Quiz unavailable.");
          return;
        }

        window.location.href = "/quiz";
      })();
    });
  }

  return (
    <div className={QUIZ_SHELL_CLASS}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6">
        <div className="flex items-center justify-between gap-4 pb-4">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-wine">
            {copy.title}
          </h1>
          <Link className="text-sm font-medium text-wine" href="/quiz">
            {copy.back}
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="rounded-[1rem] bg-white/60 px-3 py-3 text-sm text-neutral-600 shadow-[0_12px_28px_-24px_rgba(0,0,0,0.2)]">
            {copy.empty}
          </p>
        ) : (
          <div className="grid min-h-0 gap-2 overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.sessionId}
                className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/68 px-3 py-3 shadow-[0_12px_28px_-24px_rgba(0,0,0,0.2)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatHistoryDate(item.completedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => replayQuiz(item.quizId)}
                  className="shrink-0 text-xs font-medium text-wine transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {copy.replay}
                </button>
              </div>
            ))}
          </div>
        )}

        {errorMessage ? (
          <p className="pt-3 text-center text-sm text-red-700">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
