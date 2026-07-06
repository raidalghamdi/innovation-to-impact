'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';

type Setting = { key: string; value: any; description: string | null };

// src/components/platform-settings-client.tsx:1
export function PlatformSettingsClient({ settings, locale }: { settings: Setting[]; locale: string }) {
  const t = useTranslations('admin');
  const [rows, setRows] = useState(settings);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function toggle(key: string, current: boolean) {
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: !current }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value: !current } : r)));
      }
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isBool = typeof row.value === 'boolean';
        return (
          <Card key={row.key}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="font-mono text-xs text-brand-teal">{row.key}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                {!isBool && (
                  <p className="mt-1 text-sm font-medium text-foreground" dir="ltr">
                    {JSON.stringify(row.value)}
                  </p>
                )}
              </div>
              {isBool && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.value}
                  disabled={savingKey === row.key}
                  onClick={() => toggle(row.key, row.value)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    row.value ? 'bg-brand-teal' : 'bg-muted'
                  } disabled:opacity-60`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      row.value ? 'translate-x-1 rtl:-translate-x-1' : 'translate-x-6 rtl:-translate-x-6'
                    }`}
                  />
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
