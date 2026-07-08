'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  FileText,
  Newspaper,
  MessageSquare,
  Activity,
  ShieldCheck,
  Lightbulb,
  UserCheck,
  Layers,
  Users,
  Gavel,
  TrendingUp,
  Download,
  Mail,
  Loader2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Localised metadata mirroring src/lib/reports/types.ts so the picker stays
// declarative on the client. If you edit one, update the other.
type ReportType =
  | 'executive' | 'detailed' | 'media' | 'cx' | 'operational' | 'audit'
  | 'ideas' | 'evaluators' | 'themes' | 'innovators' | 'committee' | 'trends';

type Format = 'pdf' | 'xlsx' | 'pptx';
type Delivery = 'download' | 'email';

const REPORTS: Array<{
  type: ReportType;
  icon: LucideIcon;
  name_ar: string;
  name_en: string;
  desc_ar: string;
  desc_en: string;
}> = [
  { type: 'executive', icon: BarChart3, name_ar: 'التقرير التنفيذي', name_en: 'Executive Report', desc_ar: 'مؤشرات عليا للقيادة.', desc_en: 'Top-level KPIs for leadership.' },
  { type: 'detailed', icon: FileText, name_ar: 'التقرير التفصيلي', name_en: 'Detailed Report', desc_ar: 'قائمة تفصيلية بجميع الأفكار.', desc_en: 'Row-level breakdown of every idea.' },
  { type: 'media', icon: Newspaper, name_ar: 'تقرير الإعلام والتواصل', name_en: 'Media Report', desc_ar: 'قصص جاهزة للنشر.', desc_en: 'Publication-ready stories.' },
  { type: 'cx', icon: MessageSquare, name_ar: 'تجربة المستخدم', name_en: 'CX Report', desc_ar: 'رضا المستفيدين والتفاعلات.', desc_en: 'Innovator satisfaction and interactions.' },
  { type: 'operational', icon: Activity, name_ar: 'التقرير التشغيلي', name_en: 'Operational Report', desc_ar: 'طوابير العمل واتفاقيات الخدمة.', desc_en: 'Queues and SLA compliance.' },
  { type: 'audit', icon: ShieldCheck, name_ar: 'المراجعة والامتثال', name_en: 'Audit Report', desc_ar: 'سجل العمليات للمراجعين.', desc_en: 'Audit trail for reviewers.' },
  { type: 'ideas', icon: Lightbulb, name_ar: 'تقرير الأفكار', name_en: 'Ideas Report', desc_ar: 'كل فكرة مع بياناتها.', desc_en: 'Every idea with metadata.' },
  { type: 'evaluators', icon: UserCheck, name_ar: 'المُقيّمون', name_en: 'Evaluators', desc_ar: 'إنتاجية المُقيّمين.', desc_en: 'Evaluator productivity.' },
  { type: 'themes', icon: Layers, name_ar: 'المسارات الاستراتيجية', name_en: 'Themes Report', desc_ar: 'أداء كل مسار.', desc_en: 'Per-track performance.' },
  { type: 'innovators', icon: Users, name_ar: 'المبتكرون', name_en: 'Innovators', desc_ar: 'قائمة المبتكرين.', desc_en: 'Innovator roster.' },
  { type: 'committee', icon: Gavel, name_ar: 'قرارات اللجنة', name_en: 'Committee Decisions', desc_ar: 'قرارات اللجنة والنِصاب.', desc_en: 'Committee decisions and quorum.' },
  { type: 'trends', icon: TrendingUp, name_ar: 'الاتجاهات', name_en: 'Trends Report', desc_ar: 'اتجاهات زمنية شهرية.', desc_en: 'Monthly time-series trends.' },
];

export function ReportsCenter({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [format, setFormat] = useState<Format>('pdf');
  const [delivery, setDelivery] = useState<Delivery>('download');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recipients, setRecipients] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const active = useMemo(() => REPORTS.find((r) => r.type === selected) ?? null, [selected]);

  function reset() {
    setSelected(null);
    setFormat('pdf');
    setDelivery('download');
    setFrom('');
    setTo('');
    setRecipients('');
    setFlash(null);
  }

  async function submit() {
    if (!active) return;
    const recips = recipients
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));
    if (delivery === 'email' && recips.length === 0) {
      setFlash({ ok: false, msg: isAr ? 'يجب إدخال بريد إلكتروني واحد على الأقل.' : 'Enter at least one email address.' });
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: active.type,
          format,
          delivery,
          from: from || undefined,
          to: to || undefined,
          recipients: delivery === 'email' ? recips : undefined,
          locale: isAr ? 'ar' : 'en',
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFlash({ ok: false, msg: (isAr ? 'فشل: ' : 'Failed: ') + (j.error || res.statusText) });
        return;
      }

      if (delivery === 'download') {
        // Response is the file bytes.
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const nameMatch = cd.match(/filename="([^"]+)"/);
        const filename = nameMatch ? nameMatch[1] : `report.${format}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setFlash({ ok: true, msg: isAr ? 'تم تحميل التقرير.' : 'Report downloaded.' });
      } else {
        setFlash({
          ok: true,
          msg: isAr ? `أُرسل التقرير إلى ${recips.length} مستلم.` : `Sent to ${recips.length} recipient(s).`,
        });
      }
    } catch (e) {
      setFlash({ ok: false, msg: (isAr ? 'خطأ: ' : 'Error: ') + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const isActive = selected === r.type;
          return (
            <button
              key={r.type}
              type="button"
              onClick={() => {
                setSelected(r.type);
                setFlash(null);
              }}
              className="text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-xl"
            >
              <Card
                className={`h-full transition ${
                  isActive
                    ? 'border-brand-teal shadow-md ring-1 ring-brand-teal/40'
                    : 'border-border hover:border-brand-teal/60'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-brand-teal/10 p-2">
                      <Icon className="h-5 w-5 text-brand-teal" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold">{isAr ? r.name_ar : r.name_en}</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isAr ? r.desc_ar : r.desc_en}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {active && (
        <Card className="mt-6 border-brand-teal/40">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xl font-bold">
                {isAr ? active.name_ar : active.name_en}
              </div>
              <Button variant="ghost" size="sm" onClick={reset} aria-label={isAr ? 'إغلاق' : 'Close'}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Format */}
              <div>
                <Label className="text-sm font-medium">{isAr ? 'الصيغة' : 'Format'}</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['pdf', 'xlsx', 'pptx'] as Format[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                        format === f
                          ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                          : 'border-border hover:border-brand-teal/40'
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery */}
              <div>
                <Label className="text-sm font-medium">
                  {isAr ? 'طريقة التسليم' : 'Delivery'}
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDelivery('download')}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                      delivery === 'download'
                        ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                        : 'border-border hover:border-brand-teal/40'
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    {isAr ? 'تحميل' : 'Download'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelivery('email')}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                      delivery === 'email'
                        ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                        : 'border-border hover:border-brand-teal/40'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    {isAr ? 'إرسال بالبريد' : 'Email'}
                  </button>
                </div>
              </div>

              {/* Date range */}
              <div>
                <Label htmlFor="rep-from" className="text-sm font-medium">
                  {isAr ? 'من تاريخ' : 'From date'}
                </Label>
                <Input
                  id="rep-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="rep-to" className="text-sm font-medium">
                  {isAr ? 'إلى تاريخ' : 'To date'}
                </Label>
                <Input
                  id="rep-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Recipients (only for email) */}
              {delivery === 'email' && (
                <div className="md:col-span-2">
                  <Label htmlFor="rep-recipients" className="text-sm font-medium">
                    {isAr ? 'المستلمون (بريد إلكتروني، مفصول بفاصلة)' : 'Recipients (comma-separated emails)'}
                  </Label>
                  <Input
                    id="rep-recipients"
                    type="text"
                    placeholder="user1@gac.gov.sa, user2@gac.gov.sa"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="mt-2"
                  />
                </div>
              )}
            </div>

            {flash && (
              <div
                className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                  flash.ok
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                }`}
              >
                {flash.msg}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isAr ? 'جاري الإنشاء…' : 'Generating…'}
                  </>
                ) : delivery === 'download' ? (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {isAr ? 'إنشاء وتحميل' : 'Generate & download'}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {isAr ? 'إنشاء وإرسال' : 'Generate & email'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
