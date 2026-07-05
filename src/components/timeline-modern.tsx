'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type TimelineStage = {
  id: string;
  titleAr: string;
  titleEn: string;
  dateRange: string;
  descriptionAr: string;
  descriptionEn: string;
  status: 'upcoming' | 'current' | 'complete';
};

// Default hackathon phases — realistic placeholder dates, editable later via CMS.
export const stages: TimelineStage[] = [
  {
    id: 'registration',
    titleAr: 'التسجيل',
    titleEn: 'Registration',
    dateRange: '١ - ١٥ سبتمبر ٢٠٢٦',
    descriptionAr: 'فتح باب التسجيل للأفراد والفرق الراغبة في المشاركة في الهاكاثون.',
    descriptionEn: 'Registration opens for individuals and teams wishing to participate.',
    status: 'complete',
  },
  {
    id: 'idea-submission',
    titleAr: 'تقديم الأفكار',
    titleEn: 'Idea Submission',
    dateRange: '١٦ سبتمبر - ٥ أكتوبر ٢٠٢٦',
    descriptionAr: 'تقديم الأفكار المبتكرة عبر المنصة ضمن المسارات المعتمدة.',
    descriptionEn: 'Submit innovative ideas through the platform under approved tracks.',
    status: 'current',
  },
  {
    id: 'initial-evaluation',
    titleAr: 'التقييم الأولي',
    titleEn: 'Initial Evaluation',
    dateRange: '٦ - ٢٠ أكتوبر ٢٠٢٦',
    descriptionAr: 'مراجعة اللجنة الفنية للأفكار المقدّمة وفق معايير التقييم المعتمدة.',
    descriptionEn: 'The technical committee reviews submitted ideas against approved criteria.',
    status: 'upcoming',
  },
  {
    id: 'pitching',
    titleAr: 'عرض الأفكار',
    titleEn: 'Pitching',
    dateRange: '٢٥ - ٢٧ أكتوبر ٢٠٢٦',
    descriptionAr: 'عرض الأفكار المتأهلة أمام لجنة التحكيم في جلسات مباشرة.',
    descriptionEn: 'Shortlisted ideas are pitched live in front of the judging panel.',
    status: 'upcoming',
  },
  {
    id: 'final-decision',
    titleAr: 'القرار النهائي',
    titleEn: 'Final Decision',
    dateRange: '٢٨ - ٣٠ أكتوبر ٢٠٢٦',
    descriptionAr: 'إعلان الأفكار الفائزة واختيار المشاريع المرشحة للتنفيذ.',
    descriptionEn: 'Winning ideas are announced and projects selected for implementation.',
    status: 'upcoming',
  },
  {
    id: 'implementation',
    titleAr: 'التنفيذ',
    titleEn: 'Implementation',
    dateRange: 'نوفمبر ٢٠٢٦ - وما بعده',
    descriptionAr: 'بدء تنفيذ المشاريع الفائزة ومتابعة الأثر الفعلي على أرض الواقع.',
    descriptionEn: 'Winning projects move into execution with real-world impact tracking.',
    status: 'upcoming',
  },
];

const STATUS_LABEL: Record<TimelineStage['status'], { ar: string; en: string }> = {
  upcoming: { ar: 'قادم', en: 'Upcoming' },
  current: { ar: 'جارٍ الآن', en: 'In progress' },
  complete: { ar: 'مكتمل', en: 'Complete' },
};

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
    <div ref={containerRef} className="relative mx-auto max-w-4xl">
      {/* Vertical spine */}
      <div
        aria-hidden="true"
        className="absolute start-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-border sm:block md:start-1/2"
      />
      <div className="space-y-8">
        {stageList.map((stage, idx) => {
          const isLeft = idx % 2 === 0;
          const title = isAr ? stage.titleAr : stage.titleEn;
          const desc = isAr ? stage.descriptionAr : stage.descriptionEn;
          const statusLabel = isAr ? STATUS_LABEL[stage.status].ar : STATUS_LABEL[stage.status].en;

          return (
            <div
              key={stage.id}
              data-timeline-item
              className={cn(
                'timeline-item relative flex flex-col gap-4 opacity-0 translate-y-4 transition-all duration-700 ease-out sm:flex-row sm:items-center',
                isLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'
              )}
            >
              {/* Dot */}
              <div
                className={cn(
                  'absolute start-1/2 top-2 z-10 hidden h-4 w-4 -translate-x-1/2 rounded-full border-4 border-background sm:block',
                  stage.status === 'current'
                    ? 'bg-brand-teal ring-4 ring-brand-teal/25'
                    : stage.status === 'complete'
                      ? 'bg-brand-teal/70'
                      : 'bg-muted-foreground/40'
                )}
              />

              {/* Card */}
              <div className={cn('sm:w-1/2', isLeft ? 'sm:pe-10' : 'sm:ps-10')}>
                <div
                  className={cn(
                    'rounded-2xl border p-5 shadow-sm transition',
                    stage.status === 'current'
                      ? 'border-brand-teal bg-brand-teal-light/30'
                      : 'border-border bg-card'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        stage.status === 'current'
                          ? 'bg-brand-teal text-white'
                          : stage.status === 'complete'
                            ? 'bg-brand-teal/20 text-brand-teal'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-semibold text-brand-teal">{title}</h3>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{stage.dateRange}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                  <span
                    className={cn(
                      'mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      stage.status === 'current'
                        ? 'bg-brand-teal text-white'
                        : stage.status === 'complete'
                          ? 'bg-brand-teal-light text-brand-teal'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Spacer for the other half on desktop */}
              <div className="hidden sm:block sm:w-1/2" />
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
