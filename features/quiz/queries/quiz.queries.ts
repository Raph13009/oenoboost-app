import { createClient } from "@/lib/supabase/server";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type {
  Quiz,
  QuizAnswer,
  QuizOptionKey,
  QuizQuestion,
  QuizQuestionLink,
  QuizSession,
  QuizType,
} from "@/types/database";

export type QuizCatalogSummary = {
  type: QuizType;
  totalPublished: number;
  completedCount: number;
  remainingCount: number;
  available: boolean;
  questionCount: number | null;
  lastCompletedAt: string | null;
  lastQuizId: string | null;
};

export type RecentQuizHistoryItem = {
  sessionId: string;
  quizId: string;
  quizType: QuizType;
  title: string;
  completedAt: string;
};

export type QuizUiQuestion = {
  id: string;
  prompt: string;
  options: Array<{
    key: QuizOptionKey;
    label: "A" | "B" | "C" | "D";
    text: string;
  }>;
};

const QUIZ_SELECT =
  "id, type, theme, title_fr, title_en, description_fr, description_en, question_count, duration_sec, is_premium, status, created_at, updated_at";

const QUIZ_QUESTION_SELECT =
  "id, type, theme, question_fr, question_en, option_a_fr, option_a_en, option_b_fr, option_b_en, option_c_fr, option_c_en, option_d_fr, option_d_en, correct_option, explanation_fr, explanation_en, related_module, scheduled_date, is_premium, status, created_at, updated_at, difficulty";

export async function getQuizCatalogSummariesForUser(
  userId: string,
): Promise<QuizCatalogSummary[]> {
  const supabase = await createClient();
  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("id, type, question_count")
    .eq("status", "published");

  if (error) {
    throw new Error(`quizzes catalog: ${error.message}`);
  }

  const publishedQuizzes = quizzes ?? [];
  const publishedQuizIds = publishedQuizzes.map((quiz) => quiz.id);

  const { data: sessions, error: sessionsError } = publishedQuizIds.length
    ? await supabase
        .from("quiz_sessions")
        .select("quiz_id, quiz_type, completed_at, created_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .in("quiz_id", publishedQuizIds)
    : { data: [], error: null };

  if (sessionsError) {
    throw new Error(`quiz_sessions catalog: ${sessionsError.message}`);
  }

  const countsByType = new Map<QuizType, number[]>();
  const completedQuizIdsByType = new Map<QuizType, Set<string>>();
  const lastCompletedAtByType = new Map<QuizType, string>();
  const lastQuizIdByType = new Map<QuizType, string>();

  for (const row of publishedQuizzes) {
    const type = row.type as QuizType;
    const count =
      typeof row.question_count === "number" ? row.question_count : null;
    if (!countsByType.has(type)) countsByType.set(type, []);
    if (count != null) countsByType.get(type)?.push(count);
  }

  for (const session of sessions ?? []) {
    const type = session.quiz_type as QuizType;
    if (!completedQuizIdsByType.has(type)) {
      completedQuizIdsByType.set(type, new Set());
    }
    completedQuizIdsByType.get(type)?.add(session.quiz_id as string);

    const completedAt = session.completed_at as string | null;
    const latest = lastCompletedAtByType.get(type);
    if (completedAt && (!latest || completedAt > latest)) {
      lastCompletedAtByType.set(type, completedAt);
      lastQuizIdByType.set(type, session.quiz_id as string);
    }
  }

  return (["beginner", "intermediate", "expert"] as const).map((type) => {
    const counts = countsByType.get(type) ?? [];
    const uniqueCounts = Array.from(new Set(counts));
    const completedCount = completedQuizIdsByType.get(type)?.size ?? 0;
    const totalPublished = counts.length;

    return {
      type,
      totalPublished,
      completedCount,
      remainingCount: Math.max(0, totalPublished - completedCount),
      available: totalPublished > 0,
      questionCount: uniqueCounts.length === 1 ? uniqueCounts[0] : null,
      lastCompletedAt: lastCompletedAtByType.get(type) ?? null,
      lastQuizId: lastQuizIdByType.get(type) ?? null,
    };
  });
}

export async function getPublishedQuizById(quizId: string): Promise<Quiz | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(QUIZ_SELECT)
    .eq("id", quizId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`quizzes get: ${error.message}`);
  }

  return (data as Quiz | null) ?? null;
}

export async function getRandomPublishedQuizByType(
  quizType: QuizType,
  userId: string,
): Promise<Quiz | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(QUIZ_SELECT)
    .eq("type", quizType)
    .eq("status", "published");

  if (error) {
    throw new Error(`quizzes random: ${error.message}`);
  }

  if (!data || data.length === 0) return null;

  const publishedQuizzes = data as Quiz[];
  const publishedQuizIds = publishedQuizzes.map((quiz) => quiz.id);

  const { data: sessions, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("quiz_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .in("quiz_id", publishedQuizIds);

  if (sessionsError) {
    throw new Error(`quiz_sessions completed filter: ${sessionsError.message}`);
  }

  const completedQuizIds = new Set(
    (sessions ?? []).map((session) => session.quiz_id as string),
  );
  const remainingQuizzes = publishedQuizzes.filter(
    (quiz) => !completedQuizIds.has(quiz.id),
  );

  if (remainingQuizzes.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * remainingQuizzes.length);
  return remainingQuizzes[randomIndex] ?? null;
}

export async function getOrderedQuizQuestions(
  quizId: string,
  locale: Locale,
): Promise<QuizUiQuestion[]> {
  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("quiz_question_links")
    .select("quiz_id, question_id, position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  if (linksError) {
    throw new Error(`quiz_question_links list: ${linksError.message}`);
  }

  const orderedLinks = (links ?? []) as QuizQuestionLink[];
  if (orderedLinks.length === 0) return [];

  const { data: questions, error: questionsError } = await supabase
    .from("quiz_questions")
    .select(QUIZ_QUESTION_SELECT)
    .in(
      "id",
      orderedLinks.map((link) => link.question_id),
    )
    .eq("status", "published");

  if (questionsError) {
    throw new Error(`quiz_questions list: ${questionsError.message}`);
  }

  const questionById = new Map(
    ((questions ?? []) as QuizQuestion[]).map((question) => [question.id, question]),
  );

  return orderedLinks
    .map((link) => {
      const question = questionById.get(link.question_id);
      if (!question) return null;

      return {
        id: question.id,
        prompt: getContent(question, "question", locale),
        options: [
          {
            key: "a",
            label: "A" as const,
            text: getContent(question, "option_a", locale),
          },
          {
            key: "b",
            label: "B" as const,
            text: getContent(question, "option_b", locale),
          },
          {
            key: "c",
            label: "C" as const,
            text: getContent(question, "option_c", locale),
          },
          {
            key: "d",
            label: "D" as const,
            text: getContent(question, "option_d", locale),
          },
        ],
      };
    })
    .filter((question): question is QuizUiQuestion => question != null);
}

export async function getRecentQuizHistoryForUser(
  userId: string,
  locale: Locale,
  limit = 5,
): Promise<RecentQuizHistoryItem[]> {
  const supabase = await createClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("id, quiz_id, quiz_type, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (sessionsError) {
    throw new Error(`quiz_sessions history: ${sessionsError.message}`);
  }

  const rows = sessions ?? [];
  if (rows.length === 0) return [];

  const quizIds = rows.map((row) => row.quiz_id as string);
  const { data: quizzes, error: quizzesError } = await supabase
    .from("quizzes")
    .select(QUIZ_SELECT)
    .in("id", quizIds)
    .eq("status", "published");

  if (quizzesError) {
    throw new Error(`quizzes history: ${quizzesError.message}`);
  }

  const quizById = new Map(((quizzes ?? []) as Quiz[]).map((quiz) => [quiz.id, quiz]));

  return rows
    .map((row) => {
      const quiz = quizById.get(row.quiz_id as string);
      if (!quiz || !row.completed_at) return null;

      return {
        sessionId: row.id as string,
        quizId: row.quiz_id as string,
        quizType: row.quiz_type as QuizType,
        title: getContent(quiz, "title", locale) || getContent(quiz, "description", locale),
        completedAt: row.completed_at as string,
      };
    })
    .filter((item): item is RecentQuizHistoryItem => item != null);
}

export async function getQuizSessionForUser(
  sessionId: string,
  userId: string,
): Promise<QuizSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, user_id, quiz_type, quiz_id, total, score, score_pct, completed_at, xp_awarded, created_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`quiz_sessions get: ${error.message}`);
  }

  return (data as QuizSession | null) ?? null;
}

export async function getQuizQuestionById(
  questionId: string,
): Promise<QuizQuestion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select(QUIZ_QUESTION_SELECT)
    .eq("id", questionId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`quiz_questions get: ${error.message}`);
  }

  return (data as QuizQuestion | null) ?? null;
}

export async function isQuestionLinkedToQuiz(
  quizId: string,
  questionId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_question_links")
    .select("question_id")
    .eq("quiz_id", quizId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(`quiz_question_links get: ${error.message}`);
  }

  return Boolean(data);
}

export async function getQuizAnswerForSessionQuestion(
  sessionId: string,
  questionId: string,
): Promise<QuizAnswer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("id, session_id, question_id, selected_option, is_correct, answered_at")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(`quiz_answers get: ${error.message}`);
  }

  return (data as QuizAnswer | null) ?? null;
}

export async function listQuizAnswersForSession(
  sessionId: string,
): Promise<QuizAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("id, session_id, question_id, selected_option, is_correct, answered_at")
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`quiz_answers list: ${error.message}`);
  }

  return (data ?? []) as QuizAnswer[];
}
