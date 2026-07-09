// Presentation-layer ladder over the real `user_profiles.points` value. Points
// are authoritative (written by the gamification system); the tier names and
// thresholds below are a display mapping only — no new data is fabricated, we
// simply bucket an existing number. Used by the evaluator dashboard + level page.

export type EvLevel = {
  index: number;
  threshold: number;
  name_ar: string;
  name_en: string;
};

export const EV_LEVELS: EvLevel[] = [
  { index: 1, threshold: 0, name_ar: 'مقيّم مبتدئ', name_en: 'Novice Evaluator' },
  { index: 2, threshold: 50, name_ar: 'مقيّم نشط', name_en: 'Active Evaluator' },
  { index: 3, threshold: 150, name_ar: 'مقيّم متمرّس', name_en: 'Seasoned Evaluator' },
  { index: 4, threshold: 300, name_ar: 'مقيّم خبير', name_en: 'Expert Evaluator' },
  { index: 5, threshold: 600, name_ar: 'مقيّم متميّز', name_en: 'Distinguished Evaluator' },
];

export function resolveLevel(points: number) {
  let current = EV_LEVELS[0];
  for (const lvl of EV_LEVELS) {
    if (points >= lvl.threshold) current = lvl;
  }
  const next = EV_LEVELS.find((l) => l.index === current.index + 1) ?? null;
  const span = next ? next.threshold - current.threshold : 1;
  const into = points - current.threshold;
  const progressPct = next ? Math.max(0, Math.min(100, Math.round((into / span) * 100))) : 100;
  return { current, next, progressPct, pointsIntoLevel: into };
}
