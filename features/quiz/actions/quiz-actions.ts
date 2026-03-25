"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/i18n/get-content";
import { getServerLocale } from "@/lib/i18n/server";
import { QUIZ_COMPLETION_XP, getLevel } from "@/features/gamification/levels";
import {
  getPublishedQuizById,
  getOrderedQuizQuestions,
  getQuizAnswerForSessionQuestion,
  getQuizQuestionById,
  getQuizSessionForUser,
  getRandomPublishedQuizByType,
  isQuestionLinkedToQuiz,
  listQuizAnswersForSession,
  type QuizUiQuestion,
} from "@/features/quiz/queries/quiz.queries";
import type {
  QuizAnswerInsert,
  QuizOptionKey,
  QuizQuestion,
  QuizSession,
  QuizSessionInsert,
  QuizType,
} from "@/types/database";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA || "public";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}

type QuizActionError =
  | "AUTH_REQUIRED"
  | "QUIZ_NOT_FOUND"
  | "ALL_QUIZZES_COMPLETED"
  | "SESSION_NOT_FOUND"
  | "SESSION_COMPLETED"
  | "QUESTION_NOT_FOUND"
  | "QUESTION_NOT_LINKED"
  | "ALREADY_ANSWERED"
  | "INVALID_OPTION"
  | "DB_ERROR";

function logQuizStep(
  level: "info" | "error",
  step: string,
  meta: Record<string, unknown>,
) {
  const payload = { step, ...meta };
  if (level === "error") console.error("[quiz]", payload);
  else console.info("[quiz]", payload);
}

async function getQuizActionLocale() {
  try {
    return await getServerLocale();
  } catch {
    return "fr" as const;
  }
}

function getQuizErrorMessage(
  locale: "fr" | "en",
  error: QuizActionError,
  fallback?: string,
) {
  const messages =
    locale === "en"
      ? {
          AUTH_REQUIRED: "You must be signed in to start or complete a quiz.",
          QUIZ_NOT_FOUND: "No published quiz is available for this level.",
          ALL_QUIZZES_COMPLETED: "All quizzes for this level have already been completed.",
          SESSION_NOT_FOUND: "Quiz session not found.",
          SESSION_COMPLETED: "This quiz has already been completed.",
          QUESTION_NOT_FOUND: "Question not found.",
          QUESTION_NOT_LINKED: "This question does not belong to the current quiz.",
          ALREADY_ANSWERED: "This question has already been answered.",
          INVALID_OPTION: "Invalid answer option.",
          DB_ERROR: "A server error occurred while saving the quiz.",
        }
      : {
          AUTH_REQUIRED: "Vous devez être connecté pour lancer ou terminer un quiz.",
          QUIZ_NOT_FOUND: "Aucun quiz publié n'est disponible pour ce niveau.",
          ALL_QUIZZES_COMPLETED: "Tous les quiz de ce niveau ont déjà été terminés.",
          SESSION_NOT_FOUND: "Session de quiz introuvable.",
          SESSION_COMPLETED: "Ce quiz a déjà été terminé.",
          QUESTION_NOT_FOUND: "Question introuvable.",
          QUESTION_NOT_LINKED: "Cette question n'appartient pas au quiz en cours.",
          ALREADY_ANSWERED: "Cette question a déjà reçu une réponse.",
          INVALID_OPTION: "Option de réponse invalide.",
          DB_ERROR: "Une erreur serveur est survenue pendant l'enregistrement du quiz.",
        };

  return fallback?.trim() || messages[error];
}

async function finalizeQuizSession(params: {
  session: QuizSession;
  userId: string;
  score: number;
  scorePct: number;
  locale: "fr" | "en";
}) {
  const admin = createAdminClient();
  logQuizStep("info", "complete_session.rpc.start", {
    sessionId: params.session.id,
    userId: params.userId,
    score: params.score,
    scorePct: params.scorePct,
  });

  const { data, error } = await admin.rpc("complete_quiz_session_and_award_xp", {
    p_session_id: params.session.id,
    p_user_id: params.userId,
    p_score: params.score,
    p_score_pct: params.scorePct,
    p_xp_gain: QUIZ_COMPLETION_XP,
  });

  if (error) {
    logQuizStep("error", "complete_session.rpc.error", {
      sessionId: params.session.id,
      userId: params.userId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    return {
      ok: false as const,
      message: getQuizErrorMessage(params.locale, "DB_ERROR", error.message),
    };
  }

  const row = Array.isArray(data) ? data[0] : null;

  logQuizStep("info", "complete_session.rpc.success", {
    sessionId: params.session.id,
    userId: params.userId,
    xpAwarded: row?.xp_awarded ?? null,
    userXp: row?.user_xp ?? null,
    userLevel: row?.user_level ?? null,
  });

  return {
    ok: true as const,
    completedAt:
      typeof row?.completed_at === "string" ? row.completed_at : params.session.completed_at,
  };
}

function buildSubmitSuccess(params: {
  question: QuizQuestion;
  locale: "fr" | "en";
  isCorrect: boolean;
  completed: boolean;
  score: number | null;
  scorePct: number | null;
  total: number;
}) {
  return {
    ok: true as const,
    isCorrect: params.isCorrect,
    correctOption: params.question.correct_option,
    explanation: getContent(params.question, "explanation", params.locale),
    completed: params.completed,
    score: params.score,
    scorePct: params.scorePct,
    total: params.total,
  };
}

export type StartQuizActionResult =
  | {
      ok: true;
      sessionId: string;
      quizId: string;
      quizType: QuizType;
      total: number;
      questions: QuizUiQuestion[];
    }
  | { ok: false; error: QuizActionError; message?: string };

export type SubmitQuizAnswerActionResult =
  | {
      ok: true;
      isCorrect: boolean;
      correctOption: QuizOptionKey;
      explanation: string;
      completed: boolean;
      score: number | null;
      scorePct: number | null;
      total: number;
    }
  | { ok: false; error: QuizActionError; message?: string };

async function createQuizSessionFromQuiz(params: {
  quizId: string;
  quizType: QuizType;
  userId: string;
  locale: "fr" | "en";
}): Promise<StartQuizActionResult> {
  const supabase = await createClient();
  logQuizStep("info", "start.questions.lookup", {
    quizId: params.quizId,
    quizType: params.quizType,
    userId: params.userId,
  });
  const questions = await getOrderedQuizQuestions(params.quizId, params.locale);
  if (questions.length === 0) {
    logQuizStep("error", "start.questions.empty", {
      quizId: params.quizId,
      quizType: params.quizType,
      userId: params.userId,
    });
    return {
      ok: false,
      error: "QUIZ_NOT_FOUND",
      message: getQuizErrorMessage(params.locale, "QUIZ_NOT_FOUND"),
    };
  }

  const payload: QuizSessionInsert = {
    user_id: params.userId,
    quiz_type: params.quizType,
    quiz_id: params.quizId,
    total: questions.length,
  };

  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    logQuizStep("error", "start.session.create", {
      quizId: params.quizId,
      quizType: params.quizType,
      userId: params.userId,
      message: error.message,
      code: error.code,
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: getQuizErrorMessage(params.locale, "DB_ERROR", error.message),
    };
  }

  logQuizStep("info", "start.session.created", {
    sessionId: data.id,
    quizId: params.quizId,
    quizType: params.quizType,
    userId: params.userId,
    total: questions.length,
  });

  revalidatePath("/quiz");

  return {
    ok: true,
    sessionId: data.id as string,
    quizId: params.quizId,
    quizType: params.quizType,
    total: questions.length,
    questions,
  };
}

export async function startQuizAction(
  quizType: QuizType,
): Promise<StartQuizActionResult> {
  const supabase = await createClient();
  const locale = await getQuizActionLocale();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logQuizStep("error", "start.auth", { quizType, message: authError?.message });
    return {
      ok: false,
      error: "AUTH_REQUIRED",
      message: getQuizErrorMessage(locale, "AUTH_REQUIRED"),
    };
  }

  try {
    logQuizStep("info", "start.quiz.lookup", { quizType, userId: user.id });
    const quiz = await getRandomPublishedQuizByType(quizType, user.id);

    if (!quiz) {
      logQuizStep("info", "start.quiz.none_remaining", {
        quizType,
        userId: user.id,
      });
      return {
        ok: false,
        error: "ALL_QUIZZES_COMPLETED",
        message: getQuizErrorMessage(locale, "ALL_QUIZZES_COMPLETED"),
      };
    }

    return await createQuizSessionFromQuiz({
      quizId: quiz.id,
      quizType,
      userId: user.id,
      locale,
    });
  } catch (error) {
    logQuizStep("error", "start.unhandled", {
      quizType,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown quiz error",
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: getQuizErrorMessage(
        locale,
        "DB_ERROR",
        error instanceof Error ? error.message : "Unknown quiz error",
      ),
    };
  }
}

export async function replayQuizAction(
  quizId: string,
): Promise<StartQuizActionResult> {
  const supabase = await createClient();
  const locale = await getQuizActionLocale();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "AUTH_REQUIRED",
      message: getQuizErrorMessage(locale, "AUTH_REQUIRED"),
    };
  }

  try {
    logQuizStep("info", "replay.quiz.lookup", { quizId, userId: user.id });
    const quiz = await getPublishedQuizById(quizId);

    if (!quiz) {
      return {
        ok: false,
        error: "QUIZ_NOT_FOUND",
        message: getQuizErrorMessage(locale, "QUIZ_NOT_FOUND"),
      };
    }

    return await createQuizSessionFromQuiz({
      quizId: quiz.id,
      quizType: quiz.type,
      userId: user.id,
      locale,
    });
  } catch (error) {
    logQuizStep("error", "replay.unhandled", {
      quizId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown replay error",
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: getQuizErrorMessage(
        locale,
        "DB_ERROR",
        error instanceof Error ? error.message : "Unknown replay error",
      ),
    };
  }
}

export async function submitQuizAnswerAction(input: {
  sessionId: string;
  questionId: string;
  selectedOption: QuizOptionKey;
}): Promise<SubmitQuizAnswerActionResult> {
  const locale = await getQuizActionLocale();
  if (!["a", "b", "c", "d"].includes(input.selectedOption)) {
    return {
      ok: false,
      error: "INVALID_OPTION",
      message: getQuizErrorMessage(locale, "INVALID_OPTION"),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logQuizStep("error", "submit.auth", {
      sessionId: input.sessionId,
      questionId: input.questionId,
      message: authError?.message,
    });
    return {
      ok: false,
      error: "AUTH_REQUIRED",
      message: getQuizErrorMessage(locale, "AUTH_REQUIRED"),
    };
  }

  try {
    logQuizStep("info", "submit.session.lookup", {
      sessionId: input.sessionId,
      questionId: input.questionId,
      userId: user.id,
    });
    const session = await getQuizSessionForUser(input.sessionId, user.id);

    if (!session) {
      return {
        ok: false,
        error: "SESSION_NOT_FOUND",
        message: getQuizErrorMessage(locale, "SESSION_NOT_FOUND"),
      };
    }

    logQuizStep("info", "submit.question.lookup", {
      sessionId: input.sessionId,
      questionId: input.questionId,
      userId: user.id,
    });
    const question = await getQuizQuestionById(input.questionId);
    if (!question) {
      return {
        ok: false,
        error: "QUESTION_NOT_FOUND",
        message: getQuizErrorMessage(locale, "QUESTION_NOT_FOUND"),
      };
    }

    const isLinked = await isQuestionLinkedToQuiz(session.quiz_id, input.questionId);
    if (!isLinked) {
      return {
        ok: false,
        error: "QUESTION_NOT_LINKED",
        message: getQuizErrorMessage(locale, "QUESTION_NOT_LINKED"),
      };
    }

    const existingAnswer = await getQuizAnswerForSessionQuestion(
      input.sessionId,
      input.questionId,
    );
    const isCorrect = existingAnswer
      ? existingAnswer.is_correct
      : question.correct_option === input.selectedOption;

    if (!existingAnswer) {
      const answerPayload: QuizAnswerInsert = {
        session_id: input.sessionId,
        question_id: input.questionId,
        selected_option: input.selectedOption,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      };

      logQuizStep("info", "submit.answer.insert", {
        sessionId: input.sessionId,
        questionId: input.questionId,
        userId: user.id,
      });
      const { error: insertError } = await supabase
        .from("quiz_answers")
        .insert(answerPayload);

      if (insertError) {
        logQuizStep("error", "submit.answer.insert", {
          sessionId: input.sessionId,
          questionId: input.questionId,
          userId: user.id,
          message: insertError.message,
          code: insertError.code,
        });
        return {
          ok: false,
          error: "DB_ERROR",
          message: getQuizErrorMessage(locale, "DB_ERROR", insertError.message),
        };
      }
    } else {
      logQuizStep("info", "submit.answer.reuse_existing", {
        sessionId: input.sessionId,
        questionId: input.questionId,
        userId: user.id,
        answeredAt: existingAnswer.answered_at,
      });
    }

    logQuizStep("info", "submit.answers.list", {
      sessionId: input.sessionId,
      userId: user.id,
    });
    const answers = await listQuizAnswersForSession(input.sessionId);
    const score = answers.reduce(
      (total, answer) => total + (answer.is_correct ? 1 : 0),
      0,
    );
    const completed = answers.length >= session.total;
    const scorePct =
      session.total > 0 ? Math.round((score / session.total) * 100) : 0;

    if (session.completed_at) {
      return buildSubmitSuccess({
        question,
        locale,
        isCorrect,
        completed: true,
        score: session.score ?? score,
        scorePct: session.score_pct ?? scorePct,
        total: session.total,
      });
    }

    if (completed) {
      const completion = await finalizeQuizSession({
        session,
        userId: user.id,
        score,
        scorePct,
        locale,
      });

      if (!completion.ok) {
        return {
          ok: false,
          error: "DB_ERROR",
          message: completion.message,
        };
      }
    }

    revalidatePath("/quiz");
    revalidatePath("/profil");

    return buildSubmitSuccess({
      question,
      locale,
      isCorrect,
      completed,
      score: completed ? score : null,
      scorePct: completed ? scorePct : null,
      total: session.total,
    });
  } catch (error) {
    logQuizStep("error", "submit.unhandled", {
      sessionId: input.sessionId,
      questionId: input.questionId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown quiz error",
    });
    return {
      ok: false,
      error: "DB_ERROR",
      message: getQuizErrorMessage(
        locale,
        "DB_ERROR",
        error instanceof Error ? error.message : "Unknown quiz error",
      ),
    };
  }
}
