"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import { QUIZ_COMPLETION_XP } from "@/features/gamification/levels";

export type DailyQuestionAnswerInput = {
  questionId: string;
  selectedOption: "a" | "b"; // Vrai/Faux mapping
};

type DailyQuestionAnswerSuccess = {
  ok: true;
  isCorrect: boolean;
  explanation: string;
  xpAwarded: boolean;
  xpGain: number;
  userXp: number;
  userLevel: number;
};

type DailyQuestionAnswerError = {
  ok: false;
  message: string;
};

export type DailyQuestionAnswerResult =
  | DailyQuestionAnswerSuccess
  | DailyQuestionAnswerError;

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

function getExplanationForLocale(params: {
  explanationFr: string | null;
  explanationEn: string | null;
  locale: Locale;
}) {
  if (params.locale === "en") return params.explanationEn ?? params.explanationFr ?? "";
  return params.explanationFr ?? params.explanationEn ?? "";
}

export async function answerDailyQuestionAction(
  input: DailyQuestionAnswerInput,
): Promise<DailyQuestionAnswerResult> {
  const locale = await getServerLocale();

  if (!input?.questionId || !["a", "b"].includes(input.selectedOption)) {
    return { ok: false, message: "Invalid answer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Login required." };
  }

  const admin = createAdminClient();
  const userId = user.id;

  const { data: question, error: questionError } = await admin
    .from("quiz_questions")
    .select(
      "id, type, status, correct_option, explanation_fr, explanation_en",
    )
    .eq("id", input.questionId)
    .maybeSingle();

  if (questionError || !question) {
    return { ok: false, message: "Daily question not found." };
  }

  if (question.type !== "daily" || question.status !== "published") {
    return { ok: false, message: "Daily question unavailable." };
  }

  // Check whether user already answered this question (unique guard).
  const { data: existingLog } = await admin
    .from("user_daily_question_log")
    .select("is_correct")
    .eq("user_id", userId)
    .eq("question_id", input.questionId)
    .maybeSingle();

  const computedCorrect =
    String(question.correct_option) === input.selectedOption;

  if (existingLog) {
    // No XP award on repeats.
    const explanation = getExplanationForLocale({
      explanationFr: question.explanation_fr as string | null,
      explanationEn: question.explanation_en as string | null,
      locale,
    });

    // Fetch current xp/level so UI stays consistent.
    const { data: userRow } = await admin
      .from("users")
      .select("xp, level")
      .eq("id", userId)
      .maybeSingle();

    const userXp = typeof userRow?.xp === "number" ? userRow.xp : 0;
    const userLevel = Number(userRow?.level ?? 0) || 0;

    return {
      ok: true,
      isCorrect: Boolean(existingLog.is_correct),
      explanation,
      xpAwarded: false,
      xpGain: 0,
      userXp,
      userLevel,
    };
  }

  // Compute XP + store the result.
  const xpGain = QUIZ_COMPLETION_XP;

  const shownDate = new Date().toISOString().slice(0, 10);

  const { error: insertError } = await admin
    .from("user_daily_question_log")
    .insert({
      user_id: userId,
      question_id: input.questionId,
      shown_date: shownDate,
      is_correct: computedCorrect,
      answered_at: new Date().toISOString(),
    });

  if (insertError) {
    // Race condition / unique constraint: re-read log and return it.
    const { data: retryLog } = await admin
      .from("user_daily_question_log")
      .select("is_correct")
      .eq("user_id", userId)
      .eq("question_id", input.questionId)
      .maybeSingle();

    const explanation = getExplanationForLocale({
      explanationFr: question.explanation_fr as string | null,
      explanationEn: question.explanation_en as string | null,
      locale,
    });

    const { data: userRow } = await admin
      .from("users")
      .select("xp, level")
      .eq("id", userId)
      .maybeSingle();

    const userXp = typeof userRow?.xp === "number" ? userRow.xp : 0;
    const userLevel = Number(userRow?.level ?? 0) || 0;

    return {
      ok: true,
      isCorrect: Boolean(retryLog?.is_correct ?? computedCorrect),
      explanation,
      xpAwarded: false,
      xpGain: 0,
      userXp,
      userLevel,
    };
  }

  // Award XP in app-level (same gamification thresholds).
  const { data: userRow } = await admin
    .from("users")
    .select("xp, level")
    .eq("id", userId)
    .maybeSingle();

  const currentXp = typeof userRow?.xp === "number" ? userRow.xp : 0;
  const newXp = currentXp + xpGain;

  const { data: levelResult, error: levelError } = await admin.rpc(
    "user_level_for_xp",
    { p_xp: newXp },
  );

  if (levelError) {
    throw new Error(`Daily question level calc: ${levelError.message}`);
  }

  const newLevel = typeof levelResult === "number" ? levelResult : 0;

  const { data: updatedUserRow } = await admin
    .from("users")
    .update({ xp: newXp, level: String(newLevel) })
    .eq("id", userId)
    .select("xp, level")
    .maybeSingle();

  const userXp = typeof updatedUserRow?.xp === "number" ? updatedUserRow.xp : newXp;
  const userLevel = Number(updatedUserRow?.level ?? newLevel) || newLevel;

  const explanation = getExplanationForLocale({
    explanationFr: question.explanation_fr as string | null,
    explanationEn: question.explanation_en as string | null,
    locale,
  });

  return {
    ok: true,
    isCorrect: computedCorrect,
    explanation,
    xpAwarded: true,
    xpGain,
    userXp,
    userLevel,
  };
}

