"use client";

import { useState, useTransition } from "react";

import type {
  DailyQuestionAnswerResult,
  DailyQuestionAnswerInput,
} from "@/features/quiz/actions/daily-question-actions";
import { answerDailyQuestionAction } from "@/features/quiz/actions/daily-question-actions";

type Copy = {
  trueLabel: string;
  falseLabel: string;
  explanationLabel: string;
  correctTitle: string;
  wrongTitle: string;
};

type Props = {
  questionId: string;
  prompt: string;
  copy: Copy;
};

export function DailyQuestionClient({ questionId, prompt, copy }: Props) {
  const [result, setResult] = useState<DailyQuestionAnswerResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const select = (selectedOption: DailyQuestionAnswerInput["selectedOption"]) => {
    if (result != null) return;
    if (isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await answerDailyQuestionAction({ questionId, selectedOption });
      if (!res.ok) {
        setResult(null);
        setErrorMessage(res.message);
        return;
      }

      setResult(res);
    });
  };

  const isCorrect = result?.ok ? result.isCorrect : null;
  const explanation = result?.ok ? result.explanation : null;
  const xpAwarded = result?.ok ? result.xpAwarded : false;
  const xpGain = result?.ok ? result.xpGain : 0;

  return (
    <div className="flex flex-col items-center gap-5 px-1 text-center">
      <div className="max-w-xl">
        <h1 className="font-heading text-[22px] font-semibold leading-snug tracking-tight md:text-[28px]">
          {prompt}
        </h1>
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {result == null ? (
        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-xl border border-border bg-card px-3 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent/20 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            onClick={() => select("a")}
            disabled={isPending}
          >
            {copy.trueLabel}
          </button>
          <button
            type="button"
            className="rounded-xl border border-border bg-card px-3 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent/20 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            onClick={() => select("b")}
            disabled={isPending}
          >
            {copy.falseLabel}
          </button>
        </div>
      ) : null}

      {result?.ok ? (
        <div className="flex w-full max-w-md flex-col gap-3">
          <div className="rounded-xl bg-muted/30 p-4">
            <p
              className={
                isCorrect
                  ? "font-heading text-lg font-semibold text-foreground"
                  : "font-heading text-lg font-semibold text-foreground"
              }
            >
              {isCorrect ? copy.correctTitle : copy.wrongTitle}
            </p>
            {xpAwarded ? (
              <p className="mt-2 text-sm text-muted-foreground">
                +{xpGain} XP
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 text-left">
            <p className="text-sm font-medium text-muted-foreground">
              {copy.explanationLabel}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {explanation}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

