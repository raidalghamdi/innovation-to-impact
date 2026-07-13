'use client';

// Post-program manual stage controls (R43, admin only). Lists approved and
// post-program ideas and advances them along approved -> in_pilot ->
// in_measurement -> in_scaling via POST /api/admin/ideas/[id]/post-program-stage.
// Each idea only shows the button for its single next stage.
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { useToastStack, ToastStack } from '@/components/ui/toast';

type Idea = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  status: string;
};

// The linear post-program order. Each status maps to the single next stage.
const NEXT_STAGE: Record<string, 'in_pilot' | 'in_measurement' | 'in_scaling' | null> = {
  approved: 'in_pilot',
  in_pilot: 'in_measurement',
  in_measurement: 'in_scaling',
  in_scaling: null,
};

export function PostProgramDashboard({ ideas: initial }: { ideas: Idea[] }) {
  const t = useTranslations('admin.postProgram');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { toasts, push, dismiss } = useToastStack();

  const [ideas, setIdeas] = useState<Idea[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const title = (idea: Idea) =>
    (isAr ? idea.title_ar || idea.title_en : idea.title_en || idea.title_ar) || idea.code || idea.id;

  const stageLabel = (stage: string) => {
    switch (stage) {
      case 'in_pilot':
        return t('pilot');
      case 'in_measurement':
        return t('measurement');
      case 'in_scaling':
        return t('scaling');
      default:
        return stage;
    }
  };

  async function advance(idea: Idea) {
    const next = NEXT_STAGE[idea.status];
    if (!next) return;
    setBusyId(idea.id);
    try {
      const res = await fetch(`/api/admin/ideas/${idea.id}/post-program-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setIdeas((prev) =>
          prev.map((i) => (i.id === idea.id ? { ...i, status: j.status ?? next } : i))
        );
        push({ title: t('advanced', { stage: stageLabel(next) }) });
      } else {
        push({ title: t('advanceFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('advanceFailed') });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {ideas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <Th>{t('code')}</Th>
                      <Th>{t('idea')}</Th>
                      <Th>{t('stage')}</Th>
                      <Th>{t('advance')}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ideas.map((idea) => {
                      const next = NEXT_STAGE[idea.status];
                      return (
                        <tr key={idea.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {idea.code || '—'}
                          </td>
                          <td className="px-3 py-2 font-medium">{title(idea)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={idea.status} locale={locale} />
                          </td>
                          <td className="px-3 py-2">
                            {next ? (
                              <Button
                                size="sm"
                                disabled={busyId === idea.id}
                                onClick={() => advance(idea)}
                              >
                                {t('advanceTo', { stage: stageLabel(next) })}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t('final')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-3 md:hidden">
                {ideas.map((idea) => {
                  const next = NEXT_STAGE[idea.status];
                  return (
                    <div key={idea.id} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-muted-foreground">
                            {idea.code || '—'}
                          </div>
                          <div className="font-medium">{title(idea)}</div>
                        </div>
                        <StatusBadge status={idea.status} locale={locale} />
                      </div>
                      {next ? (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={busyId === idea.id}
                          onClick={() => advance(idea)}
                        >
                          {t('advanceTo', { stage: stageLabel(next) })}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('final')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-semibold">{children}</th>;
}
