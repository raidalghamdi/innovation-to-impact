'use client';

// CMS text editor — two-pane layout.
//   Left:  page picker (Landing, Dashboard, About, ...) with block counts and
//          a badge showing unsaved changes per page.
//   Right: sections for the selected page, each rendered as a card with a
//          clear title, an inline "Visible/Hidden" toggle, and one row per
//          editable text field. Each row has EN + AR side-by-side, with the
//          key and kind labeled clearly. Rows with unsaved changes highlight
//          in amber. A sticky save bar at the bottom keeps the primary action
//          in reach while scrolling long sections.
//
// Only admins can save because RLS on innovation.cms_blocks restricts writes.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Save, Eye, EyeOff, ExternalLink, FileText, ChevronRight, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { defaultTextFor } from '@/lib/cms-defaults';

type Block = {
  id: string;
  page: string;
  section: string;
  key: string | null;
  kind: 'text' | 'richtext' | 'html' | 'section';
  enabled: boolean;
  value_en: string | null;
  value_ar: string | null;
  sort_order: number;
};

const PAGE_ROUTE: Record<string, string> = {
  landing: '/',
  dashboard: '/dashboard',
  about: '/about',
  faq: '/faq',
  partners: '/partners',
  target_audience: '/target-audience',
  evaluation_criteria: '/evaluation-criteria',
  expected_solutions: '/expected-solutions',
  support: '/support',
  events: '/events',
  roadmap: '/roadmap',
};

const PAGE_LABEL: Record<string, { en: string; ar: string }> = {
  landing: { en: 'Landing page', ar: 'الصفحة الرئيسية' },
  dashboard: { en: 'Dashboard widgets', ar: 'ودجات لوحة العمل' },
  about: { en: 'About', ar: 'عن المنصة' },
  faq: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  partners: { en: 'Partners', ar: 'الشركاء' },
  target_audience: { en: 'Target audience', ar: 'الفئة المستهدفة' },
  evaluation_criteria: { en: 'Evaluation criteria', ar: 'معايير التقييم' },
  expected_solutions: { en: 'Expected solutions', ar: 'الحلول المتوقعة' },
  support: { en: 'Support', ar: 'الدعم' },
  events: { en: 'Events', ar: 'الفعاليات' },
  roadmap: { en: 'Roadmap', ar: 'الخارطة الزمنية' },
};

// Friendly labels for common section names so admins don't see raw slugs.
const SECTION_LABEL: Record<string, { en: string; ar: string }> = {
  hero: { en: 'Hero (top banner)', ar: 'البطل (البانر العلوي)' },
  about: { en: 'About', ar: 'عن البرنامج' },
  tracks: { en: 'Tracks / themes', ar: 'المسارات / المحاور' },
  criteria: { en: 'Evaluation criteria', ar: 'معايير التقييم' },
  prizes: { en: 'Prizes', ar: 'الجوائز' },
  timeline: { en: 'Timeline', ar: 'الخط الزمني' },
  faq: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  partners: { en: 'Partners', ar: 'الشركاء' },
  cta: { en: 'Call to action', ar: 'دعوة للعمل' },
  footer: { en: 'Footer', ar: 'التذييل' },
  header: { en: 'Header', ar: 'الرأس' },
  intro: { en: 'Intro', ar: 'المقدمة' },
  details: { en: 'Details', ar: 'التفاصيل' },
  rules: { en: 'Rules', ar: 'الشروط' },
  objectives: { en: 'Objectives', ar: 'الأهداف' },
  previous: { en: 'Previous editions', ar: 'الدورات السابقة' },
};

function labelOf(map: Record<string, { en: string; ar: string }>, code: string, isAr: boolean) {
  return map[code]?.[isAr ? 'ar' : 'en'] ?? code;
}

export function CmsEditor({ locale }: { locale: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activePage, setActivePage] = useState<string>('landing');
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from('cms_blocks')
      .select('*')
      .order('page')
      .order('sort_order')
      .then(({ data }) => {
        // For each row, if there is no admin override yet, pre-fill the field
        // with the current site default text so the admin can edit it directly.
        const rows = ((data as Block[]) ?? []).map((b) => ({
          ...b,
          value_en:
            b.value_en && b.value_en.trim().length > 0
              ? b.value_en
              : defaultTextFor(b.page, b.section, b.key, 'en'),
          value_ar:
            b.value_ar && b.value_ar.trim().length > 0
              ? b.value_ar
              : defaultTextFor(b.page, b.section, b.key, 'ar'),
        }));
        setBlocks(rows);
        setLoading(false);
      });
  }, [supabase]);

  const pages = useMemo(() => {
    const set = new Set(blocks.map((b) => b.page));
    return Array.from(set).sort();
  }, [blocks]);

  const grouped = useMemo(() => {
    const byPage = new Map<string, Map<string, Block[]>>();
    for (const b of blocks) {
      if (!byPage.has(b.page)) byPage.set(b.page, new Map());
      const bySection = byPage.get(b.page)!;
      if (!bySection.has(b.section)) bySection.set(b.section, []);
      bySection.get(b.section)!.push(b);
    }
    return byPage;
  }, [blocks]);

  // Count of unsaved changes per page — powers the badge in the left rail.
  const dirtyPerPage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of blocks) {
      if (dirty.has(b.id)) counts.set(b.page, (counts.get(b.page) ?? 0) + 1);
    }
    return counts;
  }, [blocks, dirty]);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setDirty((prev) => new Set(prev).add(id));
  }

  async function save() {
    if (!supabase || dirty.size === 0) return;
    setSaving(true);
    const rows = blocks.filter((b) => dirty.has(b.id));
    for (const r of rows) {
      await supabase
        .from('cms_blocks')
        .update({
          enabled: r.enabled,
          value_en: r.value_en,
          value_ar: r.value_ar,
        })
        .eq('id', r.id);
    }
    setSaving(false);
    setDirty(new Set());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isAr ? 'جاري تحميل المحتوى…' : 'Loading content…'}
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {isAr
          ? 'لا توجد نصوص قابلة للتحرير بعد. تم إنشاء الجدول ولكنه فارغ.'
          : 'No editable text yet. The CMS table is empty.'}
      </div>
    );
  }

  const pageBlocks = grouped.get(activePage) ?? new Map<string, Block[]>();
  const route = PAGE_ROUTE[activePage] ?? '/';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* ─── Left rail: page picker ────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-2xl border border-border bg-card p-2">
          <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAr ? 'الصفحات' : 'Pages'}
          </div>
          <ul className="space-y-1">
            {pages.map((p) => {
              const active = p === activePage;
              const count = grouped.get(p)?.size ?? 0;
              const dc = dirtyPerPage.get(p) ?? 0;
              return (
                <li key={p}>
                  <button
                    onClick={() => setActivePage(p)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-brand-teal text-white'
                        : 'text-foreground hover:bg-brand-teal-light/40'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-brand-teal'}`} />
                      <span className="truncate text-start">{labelOf(PAGE_LABEL, p, isAr)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {dc > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                          {dc}
                        </span>
                      )}
                      <span
                        className={`text-[11px] ${active ? 'text-white/70' : 'text-muted-foreground'}`}
                      >
                        {count}
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-muted-foreground'} rtl:rotate-180`} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link href={route as any} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
            <span className="ms-2">{isAr ? 'معاينة الصفحة' : 'Preview page'}</span>
            <ExternalLink className="ms-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </aside>

      {/* ─── Right column: sections for the active page ────────────────── */}
      <div className="space-y-6 pb-32">
        <div>
          <h2 className="text-xl font-bold text-brand-teal">
            {labelOf(PAGE_LABEL, activePage, isAr)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? 'يظهر النص الحالي المعروض على الموقع مباشرة. عدّل كلمة أو جملة أو استبدل النص بالكامل، ثم احفظ. استخدم «استعادة النص الأصلي» للتراجع عن أي تعديل.'
              : "The current live text is loaded into each field. Edit a word, a sentence, or replace the whole text, then save. Use 'Reset to default' to revert."}
          </p>
        </div>

        {Array.from(pageBlocks.entries()).map(([section, rows]) => {
          const toggleRow = rows.find((r) => r.kind === 'section');
          const textRows = rows.filter((r) => r.kind !== 'section');
          return (
            <Card key={section} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border bg-muted/30 pb-4">
                <div>
                  <CardTitle className="text-base text-brand-teal">
                    {labelOf(SECTION_LABEL, section, isAr)}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <code className="text-[10px]">{section}</code>
                    <span className="ms-2">
                      · {textRows.length} {isAr ? 'حقل نصي' : 'text fields'}
                    </span>
                  </p>
                </div>
                {toggleRow && (
                  <button
                    onClick={() => updateBlock(toggleRow.id, { enabled: !toggleRow.enabled })}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      toggleRow.enabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                    }`}
                    aria-pressed={toggleRow.enabled}
                  >
                    {toggleRow.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {toggleRow.enabled
                      ? isAr
                        ? 'ظاهر في الموقع'
                        : 'Visible on site'
                      : isAr
                        ? 'مخفي'
                        : 'Hidden'}
                  </button>
                )}
              </CardHeader>

              {textRows.length > 0 && (
                <CardContent className="space-y-5 p-5">
                  {textRows.map((row) => {
                    const isDirty = dirty.has(row.id);
                    const isRich = row.kind === 'richtext' || row.kind === 'html';
                    return (
                      <div
                        key={row.id}
                        className={`rounded-xl border p-4 transition ${
                          isDirty
                            ? 'border-amber-300 bg-amber-50/50'
                            : 'border-border bg-background'
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-sm font-semibold text-foreground">
                            {row.key ?? section}
                          </Label>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {row.kind}
                            </span>
                            {isDirty && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                {isAr ? 'تعديل غير محفوظ' : 'Unsaved'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const defEn = defaultTextFor(row.page, row.section, row.key, 'en');
                                const defAr = defaultTextFor(row.page, row.section, row.key, 'ar');
                                updateBlock(row.id, { value_en: defEn, value_ar: defAr });
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-brand-teal/40 hover:text-brand-teal"
                              title={isAr ? 'إعادة النص الافتراضي' : 'Reset to default'}
                            >
                              <RotateCcw className="h-3 w-3" />
                              {isAr ? 'استعادة النص الأصلي' : 'Reset to default'}
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {/* English */}
                          <div>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="inline-flex h-5 items-center rounded bg-sky-100 px-1.5 text-[10px] font-bold text-sky-800">
                                EN
                              </span>
                              <span className="text-xs text-muted-foreground">English</span>
                            </div>
                            {isRich ? (
                              <textarea
                                dir="ltr"
                                className="min-h-[88px] w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                                rows={4}
                                value={row.value_en ?? ''}
                                onChange={(e) => updateBlock(row.id, { value_en: e.target.value })}
                                placeholder={isAr ? 'اكتب النص الإنجليزي…' : 'Type English text…'}
                              />
                            ) : (
                              <Input
                                dir="ltr"
                                value={row.value_en ?? ''}
                                onChange={(e) => updateBlock(row.id, { value_en: e.target.value })}
                                placeholder={isAr ? 'اكتب النص الإنجليزي…' : 'Type English text…'}
                              />
                            )}
                          </div>

                          {/* Arabic */}
                          <div>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="inline-flex h-5 items-center rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">
                                AR
                              </span>
                              <span className="text-xs text-muted-foreground">العربية</span>
                            </div>
                            {isRich ? (
                              <textarea
                                dir="rtl"
                                className="min-h-[88px] w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                                rows={4}
                                value={row.value_ar ?? ''}
                                onChange={(e) => updateBlock(row.id, { value_ar: e.target.value })}
                                placeholder={isAr ? 'اكتب النص العربي…' : 'Type Arabic text…'}
                              />
                            ) : (
                              <Input
                                dir="rtl"
                                value={row.value_ar ?? ''}
                                onChange={(e) => updateBlock(row.id, { value_ar: e.target.value })}
                                placeholder={isAr ? 'اكتب النص العربي…' : 'Type Arabic text…'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ─── Sticky save bar ───────────────────────────────────────────── */}
      {(dirty.size > 0 || saving || savedFlash) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {savedFlash ? (
                <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                  <Check className="h-4 w-4" />
                  {isAr ? 'تم حفظ التغييرات بنجاح' : 'Changes saved'}
                </span>
              ) : dirty.size > 0 ? (
                <span className="inline-flex items-center gap-2 font-medium text-amber-800">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-400 px-2 text-xs font-bold text-amber-950">
                    {dirty.size}
                  </span>
                  {isAr ? 'تعديل غير محفوظ' : 'unsaved change(s)'}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {isAr ? 'جاري الحفظ…' : 'Saving…'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    !confirm(isAr ? 'تجاهل جميع التعديلات؟' : 'Discard all changes?')
                  )
                    return;
                  // reload from server
                  setDirty(new Set());
                  setLoading(true);
                  supabase!
                    .from('cms_blocks')
                    .select('*')
                    .order('page')
                    .order('sort_order')
                    .then(({ data }) => {
                      const rows = ((data as Block[]) ?? []).map((b) => ({
                        ...b,
                        value_en:
                          b.value_en && b.value_en.trim().length > 0
                            ? b.value_en
                            : defaultTextFor(b.page, b.section, b.key, 'en'),
                        value_ar:
                          b.value_ar && b.value_ar.trim().length > 0
                            ? b.value_ar
                            : defaultTextFor(b.page, b.section, b.key, 'ar'),
                      }));
                      setBlocks(rows);
                      setLoading(false);
                    });
                }}
                disabled={saving || dirty.size === 0}
              >
                {isAr ? 'تراجع' : 'Discard'}
              </Button>
              <Button size="sm" onClick={save} disabled={saving || dirty.size === 0}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ms-2">
                  {isAr ? 'حفظ الكل' : 'Save all'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
