export const LEVEL_THRESHOLDS = [
  { level: 0, minXp: 0 },
  { level: 1, minXp: 20 },
  { level: 2, minXp: 50 },
  { level: 3, minXp: 90 },
  { level: 4, minXp: 140 },
  { level: 5, minXp: 200 },
  { level: 6, minXp: 280 },
  { level: 7, minXp: 380 },
  { level: 8, minXp: 500 },
  { level: 9, minXp: 650 },
] as const;

export const QUIZ_COMPLETION_XP = 10;

export function getLevel(xp: number): number {
  let currentLevel = 0;

  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.minXp) currentLevel = threshold.level;
  }

  return currentLevel;
}

export function getLevelProgress(xp: number) {
  const level = getLevel(xp);
  const current =
    LEVEL_THRESHOLDS.find((threshold) => threshold.level === level) ??
    LEVEL_THRESHOLDS[0];
  const next = LEVEL_THRESHOLDS.find((threshold) => threshold.level === level + 1);

  if (!next) {
    return {
      level,
      currentXp: xp,
      currentLevelMinXp: current.minXp,
      nextLevelMinXp: current.minXp,
      progressPct: 100,
      isMaxLevel: true,
    };
  }

  const span = next.minXp - current.minXp;
  const rawProgress = span > 0 ? ((xp - current.minXp) / span) * 100 : 100;

  return {
    level,
    currentXp: xp,
    currentLevelMinXp: current.minXp,
    nextLevelMinXp: next.minXp,
    progressPct: Math.max(0, Math.min(100, rawProgress)),
    isMaxLevel: false,
  };
}
