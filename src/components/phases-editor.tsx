'use client';

// Phases editor — admin sets start/end date for each of the 7 phases.
// Uses PATCH /api/admin/phases with { idx, starts_at, ends_at } (ISO strings).

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Check, AlertCircle } from 'lucide-react';

function StatusPill({ tone, label }: { tone: 'active' | 'past' | 'future' | 'unscheduled'; label: string }) {
  const cls =
    tone === 'active'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : tone === 'past'
        ? 'bg-muted text-muted-foreground border-border'
        : tone === 'future'
          ? 'bg-sky-50 text-sky-800 border-sky-200'
          : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

type Phase = {
  idx: number;
  code: string;
  label_ar: string;
  label_en: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function PhasesEditor({ locale, initialPhases }: { locale: string; initialPhases: Phase[] }) {
  const isAr = locale === 'ar';
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const update = (idx: number, patch: Partial<Phase>) => {
    setPhases((prev) => prev.map((p) => (p.idx === idx ? { ...p, ...patch } : p)));
    setSaved((prev) => ({ ...prev, [idx]: false }));
  };

  const save = async (idx: number) => {
    const p = phases.find((x) => x.idx === idx);
    if (!p) return;
    setSaving((prev) => ({ ...prev, [idx]: true }));
    setErrors((prev) => ({ ...prev, [idx]: '' }));
    try {
      const res = await fetch('/api/admin/phases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idx,
          starts_at: p.starts_at,
          ends_at: p.ends_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save_failed');
      setSaved((prev) => ({ ...prev, [idx]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [idx]: false })), 2000);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [idx]: err instanceof Error ? err.message : 'save_failed',
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const now = Date.now();
  const isActive = (p: Phase): 'past' | 'active' | 'future' | 'unscheduled' => {
    const s = p.starts_at ? new Date(p.starts_at).getTime() : null;
    const e = p.ends_at ? new Date(p.ends_at).getTime() : null;
    if (s === null && e === null) return 'unscheduled';
    if (s !== null && now < s) return 'future';
    if (e !== null && now >= e) return 'past';
    return 'active';
  };

  return (
    <div className="space-y-4">
      {phases.map((p) => {
        const state = isActive(p);
        return (
          <Card key={p.idx}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal text-sm font-bold">
                    {p.idx + 1}
                  </span>
                  <span>{isAr ? p.label_ar : p.label_en}</span>
                </CardTitle>
                <StatusPill
                  tone={state}
                  label={
                    state === 'active'
                      ? isAr
                        ? 'نشطة الآن'
                        : 'Active now'
                      : state === 'past'
                        ? isAr
                          ? 'مكتملة'
                          : 'Completed'
                        : state === 'future'
                          ? isAr
                            ? 'قادمة'
                            : 'Upcoming'
                          : isAr
                            ? 'غير مجدولة'
                            : 'Unscheduled'
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={`starts-${p.idx}`}>
                    {isAr ? 'تاريخ البدء' : 'Start date'}
                  </Label>
                  <Input
                    id={`starts-${p.idx}`}
                    type="datetime-local"
                    value={toLocalInput(p.starts_at)}
                    onChange={(e) => update(p.idx, { starts_at: fromLocalInput(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor={`ends-${p.idx}`}>
                    {isAr ? 'تاريخ الانتهاء' : 'End date'}
                  </Label>
                  <Input
                    id={`ends-${p.idx}`}
                    type="datetime-local"
                    value={toLocalInput(p.ends_at)}
                    onChange={(e) => update(p.idx, { ends_at: fromLocalInput(e.target.value) })}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'رمز المرحلة:' : 'Phase code:'} <code>{p.code}</code>
                </p>
                <div className="flex items-center gap-3">
                  {errors[p.idx] && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {errors[p.idx]}
                    </span>
                  )}
                  {saved[p.idx] && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <Check className="h-4 w-4" />
                      {isAr ? 'تم الحفظ' : 'Saved'}
                    </span>
                  )}
                  <Button size="sm" onClick={() => save(p.idx)} disabled={saving[p.idx]}>
                    {saving[p.idx] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="ms-2">{isAr ? 'حفظ' : 'Save'}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
