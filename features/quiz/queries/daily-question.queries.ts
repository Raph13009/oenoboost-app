import type { Locale } from "@/lib/i18n/config";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type DailyQuestion = {
  questionId: string;
  prompt: string;
};

function parseDateToMs(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

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

type GetDailyQuestionParams = {
  userId: string | null;
  locale: Locale;
  isPremium: boolean;
};

export async function getDailyQuestionForUser({
  userId,
  locale,
  // Currently unused: daily question must be available to everyone.
  isPremium: _isPremium,
}: GetDailyQuestionParams): Promise<DailyQuestion> {
  const admin = createAdminClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = parseDateToMs(todayStr) ?? 0;

  const { data: candidates, error: candidatesError } = await admin
    .from("quiz_questions")
    .select("id, question_fr, question_en, scheduled_date")
    .eq("type", "daily")
    .eq("status", "published")
    // Avoid relying on DB ordering/null ordering: we sort locally.
    .limit(50);

  if (candidatesError) {
    throw new Error(
      `daily-question candidates: ${candidatesError.message}`,
    );
  }

  const dailyCandidates = (candidates ?? []) as Array<{
    id: string;
    question_fr: string;
    question_en: string;
    scheduled_date: string | null;
  }>;

  if (dailyCandidates.length === 0) {
    // Avoid crashing the Home page. Daily questions are expected to exist,
    // but we keep a safe fallback to prevent a runtime error.
    return { questionId: "", prompt: "" };
  }

  const sorted = [...dailyCandidates].sort((a, b) => {
    const aMs = parseDateToMs(a.scheduled_date);
    const bMs = parseDateToMs(b.scheduled_date);

    if (aMs == null && bMs == null) return a.id.localeCompare(b.id);
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    return aMs - bMs;
  });

  const promptFor = (q: typeof sorted[number]) =>
    locale === "en" ? q.question_en : q.question_fr;

  const pickForToday = () => {
    const withDate = sorted.filter((q) => parseDateToMs(q.scheduled_date) != null);
    if (withDate.length === 0) return sorted[0]!;

    const eligible = withDate.filter((q) => {
      const qMs = parseDateToMs(q.scheduled_date);
      return qMs != null && qMs <= todayMs;
    });

    return eligible.length > 0
      ? eligible[eligible.length - 1]!
      : withDate[0]!;
  };

  const pickUnseenForToday = (unseen: typeof sorted) => {
    const withDate = unseen.filter((q) => parseDateToMs(q.scheduled_date) != null);
    const after = withDate.find((q) => {
      const qMs = parseDateToMs(q.scheduled_date);
      return qMs != null && qMs >= todayMs;
    });
    return after ?? unseen[0]!;
  };

  // Guests: show “today” question deterministically.
  if (!userId) {
    const picked = pickForToday();
    return { questionId: picked.id, prompt: promptFor(picked) };
  }

  // If the user already answered today, we must show the same question.
  const { data: todayLog, error: todayLogError } = await admin
    .from("user_daily_question_log")
    .select("question_id")
    .eq("user_id", userId)
    .eq("shown_date", todayStr)
    .maybeSingle();

  if (todayLogError) {
    throw new Error(`daily-question today-log: ${todayLogError.message}`);
  }

  if (todayLog?.question_id) {
    const picked =
      sorted.find((q) => q.id === String(todayLog.question_id)) ?? pickForToday();
    return { questionId: picked.id, prompt: promptFor(picked) };
  }

  const { data: logs, error: logsError } = await admin
    .from("user_daily_question_log")
    .select("question_id")
    .eq("user_id", userId);

  if (logsError) {
    throw new Error(`daily-question logs: ${logsError.message}`);
  }

  const seen = new Set((logs ?? []).map((r) => String(r.question_id)));
  const unseen = sorted.filter((q) => !seen.has(q.id));

  // Cycle restart: if the user has seen everything, clear their log and pick again.
  if (unseen.length === 0) {
    const { error: deleteError } = await admin
      .from("user_daily_question_log")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(`daily-question restart: ${deleteError.message}`);
    }

    const picked = pickForToday();
    return { questionId: picked.id, prompt: promptFor(picked) };
  }

  const picked = pickUnseenForToday(unseen);
  return { questionId: picked.id, prompt: promptFor(picked) };
}

