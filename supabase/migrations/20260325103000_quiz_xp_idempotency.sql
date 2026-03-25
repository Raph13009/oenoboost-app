ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.quiz_sessions
ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.user_level_for_xp(p_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_xp, 0) >= 650 THEN 9
    WHEN COALESCE(p_xp, 0) >= 500 THEN 8
    WHEN COALESCE(p_xp, 0) >= 380 THEN 7
    WHEN COALESCE(p_xp, 0) >= 280 THEN 6
    WHEN COALESCE(p_xp, 0) >= 200 THEN 5
    WHEN COALESCE(p_xp, 0) >= 140 THEN 4
    WHEN COALESCE(p_xp, 0) >= 90 THEN 3
    WHEN COALESCE(p_xp, 0) >= 50 THEN 2
    WHEN COALESCE(p_xp, 0) >= 20 THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.complete_quiz_session_and_award_xp(
  p_session_id UUID,
  p_user_id UUID,
  p_score INTEGER,
  p_score_pct INTEGER,
  p_xp_gain INTEGER DEFAULT 10
)
RETURNS TABLE (
  completed_at TIMESTAMPTZ,
  xp_awarded BOOLEAN,
  user_xp INTEGER,
  user_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
  v_xp_awarded BOOLEAN;
  v_user_xp INTEGER;
  v_user_level INTEGER;
BEGIN
  SELECT qs.completed_at, qs.xp_awarded
  INTO v_completed_at, v_xp_awarded
  FROM public.quiz_sessions qs
  WHERE qs.id = p_session_id
    AND qs.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_session_not_found';
  END IF;

  IF v_completed_at IS NULL THEN
    UPDATE public.quiz_sessions
    SET
      completed_at = NOW(),
      score = p_score,
      score_pct = p_score_pct
    WHERE id = p_session_id
      AND user_id = p_user_id
    RETURNING quiz_sessions.completed_at, quiz_sessions.xp_awarded
    INTO v_completed_at, v_xp_awarded;
  ELSE
    UPDATE public.quiz_sessions
    SET
      score = p_score,
      score_pct = p_score_pct
    WHERE id = p_session_id
      AND user_id = p_user_id;
  END IF;

  IF COALESCE(v_xp_awarded, FALSE) = FALSE THEN
    UPDATE public.users
    SET
      xp = COALESCE(users.xp, 0) + p_xp_gain,
      level = public.user_level_for_xp(COALESCE(users.xp, 0) + p_xp_gain)::TEXT
    WHERE id = p_user_id
    RETURNING users.xp, users.level::INTEGER
    INTO v_user_xp, v_user_level;

    UPDATE public.quiz_sessions
    SET xp_awarded = TRUE
    WHERE id = p_session_id
      AND user_id = p_user_id;

    v_xp_awarded := TRUE;
  ELSE
    SELECT COALESCE(u.xp, 0), COALESCE(u.level::INTEGER, 0)
    INTO v_user_xp, v_user_level
    FROM public.users u
    WHERE u.id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT v_completed_at, v_xp_awarded, COALESCE(v_user_xp, 0), COALESCE(v_user_level, 0);
END;
$$;

WITH completed_counts AS (
  SELECT
    qs.user_id,
    COUNT(*)::INTEGER AS completed_count
  FROM public.quiz_sessions qs
  WHERE qs.completed_at IS NOT NULL
  GROUP BY qs.user_id
)
UPDATE public.users u
SET
  xp = COALESCE(cc.completed_count, 0) * 10,
  level = public.user_level_for_xp(COALESCE(cc.completed_count, 0) * 10)::TEXT
FROM completed_counts cc
WHERE u.id = cc.user_id;

UPDATE public.users u
SET
  xp = 0,
  level = '0'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.quiz_sessions qs
  WHERE qs.user_id = u.id
    AND qs.completed_at IS NOT NULL
);

UPDATE public.quiz_sessions
SET xp_awarded = TRUE
WHERE completed_at IS NOT NULL;
