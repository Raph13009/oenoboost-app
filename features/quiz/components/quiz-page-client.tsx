"use client";

import Link from "next/link";
import { RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  startQuizAction,
  submitQuizAnswerAction,
} from "@/features/quiz/actions/quiz-actions";
import { QuizScrollLock } from "@/features/quiz/components/quiz-scroll-lock";
import { QUIZ_SHELL_CLASS, QUIZ_TYPES } from "@/features/quiz/constants";
import type {
  QuizCatalogSummary,
  QuizUiQuestion,
} from "@/features/quiz/queries/quiz.queries";
import { cn } from "@/lib/utils";
import type { QuizOptionKey, QuizType } from "@/types/database";

type QuizPageCopy = {
  title: string;
  subtitle: string;
  startLabel: string;
  validating: string;
  validate: string;
  next: string;
  resultButton: string;
  restart: string;
  back: string;
  close: string;
  unavailable: string;
  questionsLabel: string;
  historyButton: string;
  lastPlayedLabel: string;
  neverPlayedLabel: string;
  replay: string;
  stateAvailable: string;
  stateReplay: string;
  stateUnavailable: string;
  progress: string;
  scoreLabel: string;
  percentageLabel: string;
  correctTitle: string;
  wrongTitle: string;
  correctAnswerLabel: string;
  explanationLabel: string;
  loadingError: string;
  resultMessages: {
    low: string;
    medium: string;
    high: string;
    perfect: string;
  };
  levels: Record<
    QuizType,
    {
      title: string;
      description: string;
    }
  >;
};

type Props = {
  catalog: QuizCatalogSummary[];
  copy: QuizPageCopy;
  initialQuizType?: QuizType;
};

type QuizFeedbackState = {
  isCorrect: boolean;
  correctOption: QuizOptionKey;
  explanation: string;
  completed: boolean;
  score: number | null;
  scorePct: number | null;
  total: number;
};

type ActiveQuizState = {
  sessionId: string;
  quizType: QuizType;
  questions: QuizUiQuestion[];
  currentIndex: number;
  selectedOption: QuizOptionKey | null;
  feedback: QuizFeedbackState | null;
};

function getOptionText(question: QuizUiQuestion, optionKey: QuizOptionKey): string {
  return question.options.find((option) => option.key === optionKey)?.text ?? "";
}

function getEntryCardTone(quizType: QuizType): string {
  switch (quizType) {
    case "beginner":
      return "from-white via-white to-wine/4";
    case "intermediate":
      return "from-white via-white to-wine/7";
    case "expert":
      return "from-white via-white to-wine/11";
  }
}

function formatLastPlayed(lastCompletedAt: string | null, copy: QuizPageCopy): string {
  if (!lastCompletedAt) return copy.neverPlayedLabel;

  try {
    return `${copy.lastPlayedLabel} ${new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(lastCompletedAt))}`;
  } catch {
    return copy.lastPlayedLabel;
  }
}

export function QuizPageClient({ catalog, copy, initialQuizType }: Props) {
  const [quiz, setQuiz] = useState<ActiveQuizState | null>(null);
  const [result, setResult] = useState<{
    quizType: QuizType;
    score: number;
    scorePct: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, startQuizTransition] = useTransition();
  const [isSubmitting, submitAnswerTransition] = useTransition();

  const catalogByType = useMemo(
    () => new Map(catalog.map((item) => [item.type, item])),
    [catalog],
  );

  const didAutoStartRef = useRef(false);
  useEffect(() => {
    if (!initialQuizType) return;
    if (didAutoStartRef.current) return;

    const meta = catalogByType.get(initialQuizType);
    const canStart =
      Boolean(meta?.available && (meta?.remainingCount ?? 0) > 0) &&
      quiz == null &&
      result == null;

    if (!canStart) return;
    didAutoStartRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    startQuiz(initialQuizType);
  }, [initialQuizType, catalogByType, quiz, result]);

  const currentQuestion =
    quiz != null ? quiz.questions[quiz.currentIndex] ?? null : null;
  const progressValue =
    quiz != null && quiz.questions.length > 0
      ? ((quiz.currentIndex + 1) / quiz.questions.length) * 100
      : 0;

  function resetToEntry() {
    setQuiz(null);
    setResult(null);
    setErrorMessage(null);
  }

  function startQuiz(quizType: QuizType) {
    setErrorMessage(null);

    startQuizTransition(() => {
      void (async () => {
        const response = await startQuizAction(quizType);

        if (!response.ok) {
          setErrorMessage(response.message ?? copy.loadingError);
          return;
        }

        setResult(null);
        setQuiz({
          sessionId: response.sessionId,
          quizType: response.quizType,
          questions: response.questions,
          currentIndex: 0,
          selectedOption: null,
          feedback: null,
        });
      })();
    });
  }

  function validateAnswer() {
    if (!quiz || !currentQuestion || !quiz.selectedOption || quiz.feedback) return;

    submitAnswerTransition(() => {
      void (async () => {
        const response = await submitQuizAnswerAction({
          sessionId: quiz.sessionId,
          questionId: currentQuestion.id,
          selectedOption: quiz.selectedOption!,
        });

        if (!response.ok) {
          setErrorMessage(response.message ?? copy.loadingError);
          return;
        }

        setQuiz((current) =>
          current == null
            ? current
            : {
                ...current,
                feedback: {
                  isCorrect: response.isCorrect,
                  correctOption: response.correctOption,
                  explanation: response.explanation,
                  completed: response.completed,
                  score: response.score,
                  scorePct: response.scorePct,
                  total: response.total,
                },
              },
        );
      })();
    });
  }

  function goNext() {
    if (!quiz || !quiz.feedback) return;

    if (quiz.feedback.completed) {
      setResult({
        quizType: quiz.quizType,
        score: quiz.feedback.score ?? 0,
        scorePct: quiz.feedback.scorePct ?? 0,
        total: quiz.feedback.total,
      });
      setQuiz(null);
      return;
    }

    setQuiz((current) =>
      current == null
        ? current
        : {
            ...current,
            currentIndex: current.currentIndex + 1,
            selectedOption: null,
            feedback: null,
          },
    );
  }

  function restartQuiz() {
    if (!result) return;
    startQuiz(result.quizType);
  }

  const resultMessage = result
    ? result.scorePct >= 100
      ? copy.resultMessages.perfect
      : result.scorePct >= 80
        ? copy.resultMessages.high
        : result.scorePct >= 50
          ? copy.resultMessages.medium
          : copy.resultMessages.low
    : null;

  return (
    <>
      <QuizScrollLock />
      <div className={QUIZ_SHELL_CLASS}>
        {quiz == null && result == null ? (
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6">
            <header className="shrink-0 space-y-1.5 text-center">
              <div className="flex items-center justify-end">
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 rounded-full border-wine/20 bg-white/70 px-3 text-wine shadow-[0_10px_24px_-20px_rgba(124,39,54,0.35)] backdrop-blur-sm hover:bg-white",
                  )}
                  href="/quiz/history"
                >
                  {copy.historyButton}
                </Link>
              </div>
              <h1 className="font-heading text-[clamp(2rem,7vw,3.6rem)] font-semibold tracking-tight text-wine">
                {copy.title}
              </h1>
              <p className="mx-auto max-w-sm text-[12px] leading-relaxed text-neutral-600 sm:text-[13px]">
                {copy.subtitle}
              </p>
            </header>

            <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-3">
              {QUIZ_TYPES.map((quizType) => {
                const meta = catalogByType.get(quizType);
                const hasHistory = Boolean(meta?.lastCompletedAt && meta?.lastQuizId);
                const canStart = Boolean(meta?.available && (meta?.remainingCount ?? 0) > 0);
                const disabled = !canStart || isStarting;
                const stateLabel = hasHistory ? copy.stateReplay : canStart ? copy.stateAvailable : copy.stateUnavailable;

                return (
                  <button
                    key={quizType}
                    type="button"
                    disabled={disabled}
                    onClick={() => startQuiz(quizType)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-[1.15rem] bg-gradient-to-br px-3 py-2.5 text-left transition-all duration-200 ease-out md:min-w-0 md:flex-1 md:rounded-[1.3rem] md:px-3.5 md:py-3",
                      getEntryCardTone(quizType),
                      disabled
                        ? "opacity-60"
                        : "shadow-[0_18px_40px_-28px_rgba(0,0,0,0.24)] active:scale-[0.99] hover:shadow-[0_22px_48px_-28px_rgba(124,39,54,0.24)]",
                    )}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,39,54,0.08),transparent_42%)]" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <h2 className="font-heading text-[clamp(1.1rem,4.7vw,1.55rem)] font-semibold tracking-tight text-wine md:text-[clamp(1rem,1.6vw,1.25rem)]">
                          {copy.levels[quizType].title}
                        </h2>
                        <p
                          className="overflow-hidden text-[10px] leading-snug text-neutral-600 md:text-[11px]"
                          style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                          }}
                        >
                          {copy.levels[quizType].description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-wine/8 px-1.75 py-0.75 text-[8px] font-medium uppercase tracking-[0.14em] text-wine md:px-2 md:text-[8px]">
                        {quizType}
                      </span>
                    </div>

                    <div className="relative mt-2 flex items-end justify-between gap-3 text-[10px] text-muted-foreground md:mt-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[8px] uppercase tracking-[0.1em] text-neutral-500 md:text-[9px]">
                          {formatLastPlayed(meta?.lastCompletedAt ?? null, copy)}
                        </div>
                        <div className="mt-1 text-[9px] uppercase tracking-[0.12em]">
                          {stateLabel}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-wine">
                        {canStart ? copy.startLabel : copy.unavailable}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {errorMessage ? (
              <p className="pt-2 text-center text-sm text-red-700">{errorMessage}</p>
            ) : null}
          </div>
        ) : null}

        {quiz != null && currentQuestion != null ? (
          <div className="relative grid h-full min-h-0 grid-rows-[auto_1fr_auto_auto] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(124,39,54,0.08),transparent_46%)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <header className="shrink-0">
              <div className="relative flex items-center justify-center pt-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={resetToEntry}
                  aria-label={copy.close}
                  className="absolute left-0 top-0 rounded-full bg-white/70 backdrop-blur-sm hover:bg-white"
                >
                  <X className="size-4" />
                </Button>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {copy.progress
                    .replace("{current}", String(quiz.currentIndex + 1))
                    .replace("{total}", String(quiz.questions.length))}
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-wine transition-[width] duration-300 ease-out"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </header>

            <div className="flex min-h-0 items-center justify-center overflow-hidden py-4 text-center">
              <h1
                key={currentQuestion.id}
                className="degust-step-enter mx-auto max-w-4xl text-balance font-heading text-[clamp(2rem,8vw,4.5rem)] leading-[0.95] font-semibold tracking-tight text-wine"
              >
                {currentQuestion.prompt}
              </h1>
            </div>

            <div className="grid min-h-[12.5rem] shrink-0 grid-cols-2 gap-2.5 pb-3">
              {currentQuestion.options.map((option) => {
                const selected = quiz.selectedOption === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={Boolean(quiz.feedback) || isSubmitting}
                    onClick={() =>
                      setQuiz((current) =>
                        current == null || current.feedback
                          ? current
                          : { ...current, selectedOption: option.key },
                      )
                    }
                    className={cn(
                      "flex min-h-0 flex-col justify-between rounded-[1.5rem] px-4 py-3 text-left transition-all duration-150",
                      selected
                        ? "bg-wine text-primary-foreground shadow-[0_18px_38px_-24px_rgba(124,39,54,0.55)]"
                        : "bg-white/72 text-foreground shadow-[0_16px_32px_-28px_rgba(0,0,0,0.32)] backdrop-blur-[2px] hover:bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.24em]",
                        selected ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {option.label}
                    </span>
                    <span
                      className="overflow-hidden text-sm leading-snug font-medium sm:text-[15px]"
                      style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 3,
                      }}
                    >
                      {option.text}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="shrink-0">
              {errorMessage ? (
                <p className="pb-2 text-center text-sm text-red-700">{errorMessage}</p>
              ) : null}
              <button
                type="button"
                disabled={!quiz.selectedOption || Boolean(quiz.feedback) || isSubmitting}
                onClick={validateAnswer}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-13 w-full rounded-[1.35rem] bg-wine text-base text-primary-foreground shadow-[0_18px_40px_-26px_rgba(124,39,54,0.56)] transition-all hover:opacity-90 disabled:translate-y-0 disabled:opacity-40",
                )}
              >
                {isSubmitting ? copy.validating : copy.validate}
              </button>
            </div>

            {quiz.feedback ? (
              <div className="absolute inset-0 z-20 transition-opacity duration-200">
                <div
                  className={cn(
                    "absolute inset-0 transition-colors duration-200",
                    quiz.feedback.isCorrect
                      ? "bg-[linear-gradient(180deg,#eefaf3_0%,#dff5ea_45%,#d6f0e4_100%)]"
                      : "bg-[linear-gradient(180deg,#fff1f1_0%,#ffe3e3_42%,#ffd7d7_100%)]",
                  )}
                />
                <div className="absolute inset-0 flex flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
                  <div className="flex h-full w-full flex-col">
                    <div className="shrink-0 text-center">
                      <p
                        className={cn(
                          "font-heading text-[clamp(2.4rem,10vw,5rem)] font-semibold tracking-tight",
                          quiz.feedback.isCorrect ? "text-emerald-800" : "text-red-700",
                        )}
                      >
                        {quiz.feedback.isCorrect ? copy.correctTitle : copy.wrongTitle}
                      </p>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                      <p className="max-w-2xl text-[13px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                        {copy.correctAnswerLabel}
                      </p>
                      <p className="mt-3 max-w-3xl text-balance font-heading text-[clamp(1.7rem,6vw,3.2rem)] leading-tight text-foreground">
                        {quiz.feedback.correctOption.toUpperCase()} ·{" "}
                        {getOptionText(currentQuestion, quiz.feedback.correctOption)}
                      </p>
                      <p className="mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-neutral-700 sm:text-base">
                        {quiz.feedback.explanation}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={goNext}
                        className={cn(
                          buttonVariants({ variant: "default", size: "lg" }),
                          "h-13 w-full rounded-[1.35rem] bg-wine text-base text-primary-foreground shadow-[0_18px_40px_-26px_rgba(124,39,54,0.56)] hover:opacity-90",
                        )}
                      >
                        {quiz.feedback.completed ? copy.resultButton : copy.next}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {result != null ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,rgba(124,39,54,0.08),transparent_46%)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 text-center">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {copy.scoreLabel}
              </p>
              <h1 className="font-heading text-[clamp(3.2rem,16vw,6rem)] font-semibold tracking-tight text-wine">
                {result.score} / {result.total}
              </h1>
              <p className="text-lg font-medium text-foreground sm:text-xl">
                {result.scorePct}% {copy.percentageLabel}
              </p>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-neutral-600">
                {resultMessage}
              </p>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3">
              <button
                type="button"
                onClick={restartQuiz}
                disabled={isStarting}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-13 w-full rounded-[1.35rem] bg-wine text-base text-primary-foreground shadow-[0_18px_40px_-26px_rgba(124,39,54,0.56)] hover:opacity-90",
                )}
              >
                <RotateCcw className="size-4" />
                {copy.restart}
              </button>
              <button
                type="button"
                onClick={resetToEntry}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-13 w-full rounded-[1.35rem] border-transparent bg-white/72 text-foreground shadow-[0_16px_32px_-28px_rgba(0,0,0,0.32)] backdrop-blur-[2px] hover:bg-white",
                )}
              >
                {copy.back}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
