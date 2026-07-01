'use client';

// CMS editor UI. Loads all cms_blocks, groups by page > section, and lets
// admins edit each text value inline (EN + AR) and toggle section visibility.
// Only admins can save because RLS on cms_blocks restricts writes.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, Save, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/routing';

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
  landing: { en: 'Landing', ar: 'الرئيسية' },
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
        setBlocks((data as Block[]) ?? []);
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
    setTimeout(() => setSavedFlash(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isAr ? 'جاري تحميل المحتوى…' : 'Loading content…'}
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        {isAr
          ? 'لا توجد كتل محتوى بعد. تم إنشاء الجدول ولكن لم يتم إدخال بيانات أولية.'
          : 'No CMS blocks yet. Table exists but is empty — reseed to populate.'}
      </p>
    );
  }

  const pageBlocks = grouped.get(activePage) ?? new Map<string, Block[]>();
  const route = PAGE_ROUTE[activePage] ?? '/';

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setActivePage(p)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activePage === p
                  ? 'bg-brand-teal text-white'
                  : 'border border-border bg-background text-muted-foreground hover:border-brand-teal/40'
              }`}
            >
              {PAGE_LABEL[p]?.[isAr ? 'ar' : 'en'] ?? p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={route} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4" />
              {isAr ? 'معاينة' : 'Preview'}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button size="sm" onClick={save} disabled={saving || dirty.size === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isAr ? 'حفظ' : 'Save'}
            {dirty.size > 0 && (
              <span className="ms-1 rounded-full bg-white/25 px-1.5 text-xs">{dirty.size}</span>
            )}
          </Button>
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              {isAr ? 'محفوظ' : 'Saved'}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      {Array.from(pageBlocks.entries()).map(([section, rows]) => {
        const toggleRow = rows.find((r) => r.kind === 'section');
        const textRows = rows.filter((r) => r.kind !== 'section');
        return (
          <Card key={section}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base text-brand-teal">{section}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {textRows.length} {isAr ? 'حقل نصي' : 'text fields'}
                </p>
              </div>
              {toggleRow && (
                <button
                  onClick={() => updateBlock(toggleRow.id, { enabled: !toggleRow.enabled })}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    toggleRow.enabled
                      ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700'
                      : 'border-red-400/40 bg-red-50 text-red-700'
                  }`}
                  aria-pressed={toggleRow.enabled}
                >
                  {toggleRow.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {toggleRow.enabled
                    ? isAr
                      ? 'ظاهر'
                      : 'Visible'
                    : isAr
                      ? 'مخفي'
                      : 'Hidden'}
                </button>
              )}
            </CardHeader>
            {textRows.length > 0 && (
              <CardContent className="space-y-4">
                {textRows.map((row) => (
                  <div key={row.id} className="grid gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.key}
                      <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {row.kind}
                      </span>
                    </label>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[11px] text-muted-foreground">English</p>
                        {row.kind === 'richtext' ? (
                          <textarea
                            className="w-full rounded-md border border-border bg-background p-2 text-sm"
                            rows={3}
                            value={row.value_en ?? ''}
                            onChange={(e) => updateBlock(row.id, { value_en: e.target.value })}
                          />
                        ) : (
                          <input
                            className="w-full rounded-md border border-border bg-background p-2 text-sm"
                            value={row.value_en ?? ''}
                            onChange={(e) => updateBlock(row.id, { value_en: e.target.value })}
                          />
                        )}
                      </div>
                      <div dir="rtl">
                        <p className="mb-1 text-[11px] text-muted-foreground">العربية</p>
                        {row.kind === 'richtext' ? (
                          <textarea
                            className="w-full rounded-md border border-border bg-background p-2 text-sm"
                            rows={3}
                            value={row.value_ar ?? ''}
                            onChange={(e) => updateBlock(row.id, { value_ar: e.target.value })}
                          />
                        ) : (
                          <input
                            className="w-full rounded-md border border-border bg-background p-2 text-sm"
                            value={row.value_ar ?? ''}
                            onChange={(e) => updateBlock(row.id, { value_ar: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isAr
                        ? 'اترك الحقل فارغاً لاستخدام النص الافتراضي من الترجمات.'
                        : 'Leave empty to use the default translation.'}
                    </p>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
