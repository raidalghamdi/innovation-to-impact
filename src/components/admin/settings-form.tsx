'use client';

// Admin runtime settings form (R43). Two numeric fields — Top N (number of
// approved ideas) and the evaluation Pass Threshold — loaded from and saved to
// GET/PUT /api/admin/settings (innovation.admin_settings). Rendered above the
// pre-existing platform-settings editor on the admin settings page.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToastStack, ToastStack } from '@/components/ui/toast';

export function SettingsForm() {
  const t = useTranslations('admin.settings');
  const { toasts, push, dismiss } = useToastStack();

  const [topN, setTopN] = useState('');
  const [passThreshold, setPassThreshold] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (typeof j.top_n === 'number') setTopN(String(j.top_n));
        if (typeof j.pass_threshold === 'number') setPassThreshold(String(j.pass_threshold));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_n: Number(topN),
          pass_threshold: Number(passThreshold),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        if (typeof j.top_n === 'number') setTopN(String(j.top_n));
        if (typeof j.pass_threshold === 'number') setPassThreshold(String(j.pass_threshold));
        push({ title: t('saved') });
      } else {
        push({ title: t('saveFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="settings-top-n">{t('topN')}</Label>
              <Input
                id="settings-top-n"
                type="number"
                min={1}
                step={1}
                value={topN}
                disabled={loading || saving}
                onChange={(e) => setTopN(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-pass-threshold">{t('passThreshold')}</Label>
              <Input
                id="settings-pass-threshold"
                type="number"
                min={0}
                step="0.1"
                value={passThreshold}
                disabled={loading || saving}
                onChange={(e) => setPassThreshold(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading || saving}>
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
