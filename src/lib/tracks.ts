// Per-track challenge content for the public track detail pages.
// Keyed by the demo strategic-theme ids (t1/t2/t3). Live tracks with
// unknown ids fall back to a generic, sensible set of challenges.

export type TrackChallenges = { ar: string[]; en: string[] };

const TRACK_CHALLENGES: Record<string, TrackChallenges> = {
  t1: {
    ar: [
      'كشف الممارسات الاحتكارية في المنصات الرقمية',
      'ضمان شفافية خوارزميات التسعير',
      'حماية المستهلك في التجارة الإلكترونية',
    ],
    en: [
      'Detecting monopolistic practices on digital platforms',
      'Ensuring transparency of pricing algorithms',
      'Protecting consumers in e-commerce',
    ],
  },
  t2: {
    ar: [
      'خفض حواجز الدخول إلى الأسواق',
      'حماية المنشآت الصغيرة من الممارسات المخلّة بالمنافسة',
      'تبسيط إجراءات الامتثال للمنشآت الناشئة',
    ],
    en: [
      'Lowering market entry barriers',
      'Protecting SMEs from anti-competitive practices',
      'Simplifying compliance procedures for startups',
    ],
  },
  t3: {
    ar: [
      'تسريع مراجعة طلبات الاندماج والاستحواذ',
      'رفع شفافية القرارات التنظيمية',
      'أتمتة تحليل تركّز الأسواق',
    ],
    en: [
      'Accelerating merger & acquisition reviews',
      'Increasing transparency of regulatory decisions',
      'Automating market concentration analysis',
    ],
  },
};

const DEFAULT_CHALLENGES: TrackChallenges = {
  ar: [
    'تحديد تحدٍّ حقيقي ضمن نطاق المسار',
    'اقتراح حل عملي قابل للتطبيق',
    'قياس الأثر المتوقع على المنافسة',
  ],
  en: [
    "Identify a real challenge within the track's scope",
    'Propose a practical, applicable solution',
    'Measure the expected impact on competition',
  ],
};

export function getTrackChallenges(trackId: string, locale: string): string[] {
  const set = TRACK_CHALLENGES[trackId] ?? DEFAULT_CHALLENGES;
  return locale === 'ar' ? set.ar : set.en;
}
