'use client';

// Committee criteria manager (R43). List + inline edit + add + delete (with
// confirm) + active toggle for innovation.committee_criteria. A live,
// non-blocking warning appears when the sum of ACTIVE weights is not 100 —
// weights are treated as percentages that should total 100 across the active
// criteria the committee scores against.
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToastStack, ToastStack } from '@/components/ui/toast';
import type { CommitteeCriterion } from '@/lib/committee-criteria';

// Weight-sum convention: active weights should total 100 (percentage points).
const TARGET_WEIGHT_SUM = 100;

type Row = CommitteeCriterion;

// The wire shape the API returns (snake_case) mapped to CommitteeCriterion.
type WireRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  weight: number | string;
  active: boolean;
};

function fromWire(r: WireRow): Row {
  return {
    id: r.id,
    code: r.code,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    descAr: r.description_ar ?? undefined,
    descEn: r.description_en ?? undefined,
    weight: typeof r.weight === 'number' ? r.weight : Number(r.weight),
    active: r.active,
  };
}

export function CriteriaEditor({ initial }: { initial: Row[] }) {
  const t = useTranslations('admin.criteria');
  const { toasts, push, dismiss } = useToastStack();
  const [rows, setRows] = useState<Row[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New-row draft.
  const [draft, setDraft] = useState({ code: '', nameAr: '', nameEn: '', weight: '' });
  const [adding, setAdding] = useState(false);

  const activeSum = useMemo(
    () => rows.filter((r) => r.active).reduce((acc, r) => acc + (Number(r.weight) || 0), 0),
    [rows]
  );
  const weightMismatch = Math.abs(activeSum - TARGET_WEIGHT_SUM) > 0.001;

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveRow(row: Row) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/committee-criteria/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: row.code,
          name_ar: row.nameAr,
          name_en: row.nameEn,
          weight: row.weight,
          active: row.active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.criterion) {
        patchLocal(row.id, fromWire(j.criterion as WireRow));
        push({ title: t('saved') });
      } else {
        push({ title: t('saveFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('saveFailed') });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: Row) {
    const next = !row.active;
    patchLocal(row.id, { active: next });
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/committee-criteria/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) {
        patchLocal(row.id, { active: !next });
        push({ title: t('saveFailed') });
      }
    } catch {
      patchLocal(row.id, { active: !next });
      push({ title: t('saveFailed') });
    } finally {
      setBusyId(null);
    }
  }

  async function removeRow(row: Row) {
    if (!window.confirm(t('deleteConfirm'))) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/committee-criteria/${row.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        push({ title: t('deleted') });
      } else {
        push({ title: t('deleteFailed') });
      }
    } catch {
      push({ title: t('deleteFailed') });
    } finally {
      setBusyId(null);
    }
  }

  async function addRow() {
    if (!draft.code.trim() || !draft.nameAr.trim() || !draft.nameEn.trim()) {
      push({ title: t('addMissing') });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/committee-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: draft.code.trim(),
          name_ar: draft.nameAr.trim(),
          name_en: draft.nameEn.trim(),
          weight: Number(draft.weight) || 0,
          active: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.criterion) {
        setRows((prev) => [...prev, fromWire(j.criterion as WireRow)]);
        setDraft({ code: '', nameAr: '', nameEn: '', weight: '' });
        push({ title: t('added') });
      } else {
        push({ title: t('addFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('addFailed') });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      {weightMismatch && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t('weightWarning', { sum: Number(activeSum.toFixed(2)), target: TARGET_WEIGHT_SUM })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <Th>{t('code')}</Th>
                    <Th>{t('nameAr')}</Th>
                    <Th>{t('nameEn')}</Th>
                    <Th>{t('weight')}</Th>
                    <Th>{t('active')}</Th>
                    <Th>{t('actions')}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2">
                        <Input
                          value={row.code}
                          onChange={(e) => patchLocal(row.id, { code: e.target.value })}
                          className="h-9 min-w-[90px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.nameAr}
                          onChange={(e) => patchLocal(row.id, { nameAr: e.target.value })}
                          className="h-9 min-w-[140px]"
                          dir="rtl"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.nameEn}
                          onChange={(e) => patchLocal(row.id, { nameEn: e.target.value })}
                          className="h-9 min-w-[140px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={String(row.weight)}
                          onChange={(e) => patchLocal(row.id, { weight: Number(e.target.value) })}
                          className="h-9 w-24"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          disabled={busyId === row.id}
                          aria-pressed={row.active}
                        >
                          <Badge variant={row.active ? 'success' : 'secondary'}>
                            {row.active ? t('active') : t('inactive')}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() => saveRow(row)}
                          >
                            {t('save')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-700 hover:bg-red-50"
                            disabled={busyId === row.id}
                            onClick={() => removeRow(row)}
                            aria-label={t('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('add')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder={t('code')}
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            />
            <Input
              placeholder={t('nameAr')}
              value={draft.nameAr}
              dir="rtl"
              onChange={(e) => setDraft((d) => ({ ...d, nameAr: e.target.value }))}
            />
            <Input
              placeholder={t('nameEn')}
              value={draft.nameEn}
              onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
            />
            <Input
              type="number"
              step="0.01"
              placeholder={t('weight')}
              value={draft.weight}
              onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
            />
          </div>
          <div className="mt-4">
            <Button onClick={addRow} disabled={adding}>
              <Plus className="h-4 w-4" />
              {adding ? t('adding') : t('add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-semibold">{children}</th>;
}
