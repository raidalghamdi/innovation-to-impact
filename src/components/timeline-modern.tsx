'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type TimelineStage = {
  id: string;
  titleAr: string;
  titleEn: string;
  dateAr: string;
  dateEn: string;
  descriptionAr: string;
  descriptionEn: string;
  tone: 'cyan' | 'gold';
};

// Competition Innovation Program hackathon timeline — 7 stops.
// The first four (registration → workshops) are cyan; the final three
// (hackathon → winners) are gold, matching the cyan→gold spine gradient.
export const stages: TimelineStage[] = [
  {
    id: 'registration-open',
    titleAr: 'فتح باب التسجيل',
    titleEn: 'Registration opens',
    dateAr: '١ أغسطس ٢٠٢٦',
    dateEn: '1 August 2026',
    descriptionAr: 'سجّل فرديًا أو ضمن فريق، واختر مسارك.',
    descriptionEn: 'Register individually or as a team, and choose your track.',
    tone: 'cyan',
  },
  {
    id: 'registration-close',
    titleAr: 'إغلاق التسجيل',
    titleEn: 'Registration closes',
    dateAr: '١٥ سبتمبر ٢٠٢٦',
    dateEn: '15 September 2026',
    descriptionAr: 'آخر موعد لاستقبال طلبات المشاركة.',
    descriptionEn: 'Final deadline to receive participation requests.',
    tone: 'cyan',
  },
  {
    id: 'teams-announced',
    titleAr: 'إعلان الفرق المقبولة',
    titleEn: 'Accepted teams announced',
    dateAr: '٢٠ سبتمبر ٢٠٢٦',
    dateEn: '20 September 2026',
    descriptionAr: 'فرز الطلبات واختيار الفرق.',
    descriptionEn: 'Applications are screened and teams selected.',
    tone: 'cyan',
  },
  {
    id: 'workshops',
    titleAr: 'ورش التأهيل',
    titleEn: 'Qualification workshops',
    dateAr: '٢٥ سبت — ٨ أكت',
    dateEn: '25 Sep — 8 Oct',
    descriptionAr: 'ورش افتراضية في التفكير التصميمي.',
    descriptionEn: 'Virtual workshops in design thinking.',
    tone: 'cyan',
  },
  {
    id: 'hackathon',
    titleAr: 'أيام الهاكاثون · ٤٨ ساعة',
    titleEn: 'Hackathon days · 48 hours',
    dateAr: '١٢ — ١٣ أكتوبر',
    dateEn: '12 — 13 October',
    descriptionAr: 'ماراثون الابتكار الحضوري.',
    descriptionEn: 'The on-site innovation marathon.',
    tone: 'gold',
  },
  {
    id: 'judging',
    titleAr: 'التحكيم',
    titleEn: 'Judging',
    dateAr: '١٤ أكتوبر — صباحًا',
    dateEn: '14 October — morning',
    descriptionAr: 'عرض الحلول أمام لجنة التحكيم.',
    descriptionEn: 'Solutions are presented to the judging panel.',
    tone: 'gold',
  },
  {
    id: 'winners',
    titleAr: 'إعلان الفائزين',
    titleEn: 'Winners announced',
    dateAr: '١٤ أكتوبر — مساءً',
    dateEn: '14 October — evening',
    descriptionAr: 'حفل الختام والتتويج.',
    descriptionEn: 'The closing and awards ceremony.',
    tone: 'gold',
  },
];

export function TimelineModern({
  stages: stageList = stages,
  locale = 'ar',
}: {
  stages?: TimelineStage[];
  locale?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-timeline-item]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [stageList]);

  return (
    <div ref={containerRef} className="relative mx-auto max-w-5xl">
      {/* Vertical spine — cyan→gold gradient.
          Mobile: near the inline-start edge. Desktop: centered. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 start-6 w-[3px] -translate-x-1/2 rounded-full rtl:translate-x-1/2 md:start-1/2"
        style={{
          background:
            'linear-gradient(180deg, #CFEDF8 0%, #CFEDF8 57%, #1C4854 57%, #1C4854 100%)',
        }}
      />

      <div className="space-y-6 md:space-y-4">
        {stageList.map((stage, idx) => {
          const isEnd = idx % 2 === 1; // desktop: alternate sides
          const title = isAr ? stage.titleAr : stage.titleEn;
          const date = isAr ? stage.dateAr : stage.dateEn;
          const desc = isAr ? stage.descriptionAr : stage.descriptionEn;
          const gold = stage.tone === 'gold';

          return (
            <div
              key={stage.id}
              data-timeline-item
              className="timeline-item relative translate-y-4 opacity-0 transition-all duration-700 ease-out md:flex md:min-h-[120px] md:items-center"
            >
              {/* Node */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute start-6 top-6 z-10 h-4 w-4 -translate-x-1/2 rounded-full rtl:translate-x-1/2 md:start-1/2 md:top-1/2 md:h-5 md:w-5 md:-translate-y-1/2',
                  gold
                    ? 'bg-brand-moon-raker shadow-[0_0_0_4px_#FFFFFF,0_0_16px_rgba(28,72,84,0.7)]'
                    : 'bg-brand-humming-bird shadow-[0_0_0_4px_#FFFFFF,0_0_16px_rgba(207,237,248,0.6)]'
                )}
              />

              {/* Card */}
              <div
                className={cn(
                  'ps-14 md:w-1/2 md:ps-0',
                  isEnd ? 'md:ms-auto md:ps-12' : 'md:pe-12'
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl border bg-card p-5 shadow-sm transition',
                    gold ? 'border-brand-gold/40' : 'border-brand-cyan/30'
                  )}
                >
                  <span
                    className={cn(
                      'block text-sm font-bold',
                      gold ? 'text-brand-gold' : 'text-brand-cyan'
                    )}
                  >
                    {date}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-brand-teal sm:text-lg">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .timeline-item.visible {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `}</style>
    </div>
  );
}

export default TimelineModern;
