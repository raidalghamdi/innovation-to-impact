'use client';

/**
 * /admin/settings — redesigned platform settings editor.
 *
 * Prior version dumped every DB key as raw snake_case with a JSON stringify
 * blob for non-booleans. This client:
 *   - Groups settings by category (auth, OTP, integrations, email, etc.).
 *   - Uses the RIGHT input for the value type:
 *       boolean → switch
 *       number  → numeric input
 *       string  → text input
 *       object  → JSON editor with parse validation
 *   - Shows a locale-aware human label + description for each key. Unknown
 *     keys fall back to the raw key but still render in a sensible editor.
 *   - Batches Save behavior per row (no whole-form save) so admins can commit
 *     one change at a time without fear of overwriting others.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, X } from 'lucide-react';

type Setting = { key: string; value: any; description: string | null };

type SettingMeta = {
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  group: 'auth' | 'otp' | 'domain' | 'integrations' | 'general';
};

const META: Record<string, SettingMeta> = {
  internal_email_domain: {
    labelAr: 'نطاق البريد الرسمي',
    labelEn: 'Internal Email Domain',
    descAr: 'النطاق الذي يعتمده النظام لتصنيف المستخدم كموظف داخلي (مثل gac.gov.sa).',
    descEn: 'Domain used to classify a user as internal (e.g. gac.gov.sa).',
    group: 'domain',
  },
  external_registration_enabled: {
    labelAr: 'السماح بالتسجيل الخارجي',
    labelEn: 'Allow External Registration',
    descAr: 'عند التفعيل، يمكن للأشخاص من خارج النطاق الرسمي إنشاء حساب.',
    descEn: 'When on, users outside the internal domain can self-register.',
    group: 'auth',
  },
};

// OTP and WhatsApp settings have been retired. Their platform_settings rows
// (otp_required, otp_length, otp_ttl_minutes, otp_max_attempts,
// whatsapp_enabled, whatsapp_provider, whatsapp_channels) are ignored here
// and will not render in the admin settings page.
const HIDDEN_KEYS = new Set([
  'otp_required',
  'otp_length',
  'otp_ttl_minutes',
  'otp_max_attempts',
  'whatsapp_enabled',
  'whatsapp_provider',
  'whatsapp_channels',
]);

const GROUP_LABELS: Record<SettingMeta['group'], { ar: string; en: string }> = {
  domain: { ar: 'النطاقات والتصنيف', en: 'Domains & Classification' },
  auth: { ar: 'التسجيل والدخول', en: 'Registration & Sign-in' },
  otp: { ar: 'رموز التحقق', en: 'One-Time Passwords' },
  integrations: { ar: 'التكاملات', en: 'Integrations' },
  general: { ar: 'إعدادات أخرى', en: 'Other Settings' },
};

const GROUP_ORDER: SettingMeta['group'][] = [
  'domain',
  'auth',
  'general',
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function PlatformSettingsClient({
  settings,
  locale,
}: {
  settings: Setting[];
  locale: string;
}) {
  useLocale();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState<Setting[]>(settings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  function setDraft(key: string, val: string) {
    setDrafts((d) => ({ ...d, [key]: val }));
  }

  async function saveValue(key: string, nextValue: any) {
    setSaveState((s) => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: nextValue }),
      });
      if (!res.ok) throw new Error('save_failed');
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value: nextValue } : r)));
      setSaveState((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => {
        setSaveState((s) => ({ ...s, [key]: 'idle' }));
      }, 2000);
    } catch {
      setSaveState((s) => ({ ...s, [key]: 'error' }));
    }
  }

  const groups: Record<SettingMeta['group'], Setting[]> = {
    domain: [],
    auth: [],
    otp: [],
    integrations: [],
    general: [],
  };
  for (const row of rows) {
    if (HIDDEN_KEYS.has(row.key)) continue;
    const meta = META[row.key];
    const g = meta?.group ?? 'general';
    groups[g].push(row);
  }

  return (
    <div className="space-y-8">
      {GROUP_ORDER.map((g) => {
        const items = groups[g];
        if (!items.length) return null;
        return (
          <section key={g} aria-labelledby={`group-${g}`}>
            <h2
              id={`group-${g}`}
              className="mb-3 text-lg font-semibold text-brand-teal"
            >
              {isAr ? GROUP_LABELS[g].ar : GROUP_LABELS[g].en}
            </h2>
            <div className="space-y-3">
              {items.map((row) => {
                const meta = META[row.key];
                const label = meta
                  ? isAr
                    ? meta.labelAr
                    : meta.labelEn
                  : row.key;
                const desc = meta
                  ? isAr
                    ? meta.descAr
                    : meta.descEn
                  : row.description ?? '';
                const state = saveState[row.key] ?? 'idle';
                return (
                  <Card key={row.key}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {label}
                          </p>
                          {desc && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {desc}
                            </p>
                          )}
                          <p
                            className="mt-1 font-mono text-[11px] text-muted-foreground/70"
                            dir="ltr"
                          >
                            {row.key}
                          </p>
                        </div>
                        <div className="sm:min-w-[16rem]">
                          {renderEditor(row, {
                            drafts,
                            setDraft,
                            saveValue,
                            state,
                            isAr,
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Per-type editors ────────────────────────────────────────────────────────

function renderEditor(
  row: Setting,
  ctx: {
    drafts: Record<string, string>;
    setDraft: (k: string, v: string) => void;
    saveValue: (k: string, v: any) => void;
    state: SaveState;
    isAr: boolean;
  },
) {
  const { key, value } = row;
  const { drafts, setDraft, saveValue, state, isAr } = ctx;

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-end gap-3">
        <StateBadge state={state} isAr={isAr} />
        <button
          type="button"
          role="switch"
          aria-checked={value}
          disabled={state === 'saving'}
          onClick={() => saveValue(key, !value)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            value ? 'bg-brand-teal' : 'bg-muted'
          } disabled:opacity-60`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              value ? 'translate-x-1 rtl:-translate-x-1' : 'translate-x-6 rtl:-translate-x-6'
            }`}
          />
        </button>
      </div>
    );
  }

  if (typeof value === 'number') {
    const draft = drafts[key] ?? String(value);
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          value={draft}
          dir="ltr"
          onChange={(e) => setDraft(key, e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={state === 'saving' || draft === String(value)}
          onClick={() => {
            const n = Number(draft);
            if (Number.isFinite(n)) saveValue(key, n);
          }}
        >
          {isAr ? 'حفظ' : 'Save'}
        </Button>
        <StateBadge state={state} isAr={isAr} />
      </div>
    );
  }

  if (typeof value === 'string') {
    const draft = drafts[key] ?? value;
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          value={draft}
          dir="ltr"
          onChange={(e) => setDraft(key, e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={state === 'saving' || draft === value}
          onClick={() => saveValue(key, draft)}
        >
          {isAr ? 'حفظ' : 'Save'}
        </Button>
        <StateBadge state={state} isAr={isAr} />
      </div>
    );
  }

  // Object / array → JSON editor with parse validation.
  const initial = JSON.stringify(value, null, 2);
  const draft = drafts[key] ?? initial;
  let parseErr: string | null = null;
  let parsed: any;
  try {
    parsed = JSON.parse(draft);
  } catch (e) {
    parseErr = (e as Error).message;
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-[6rem] w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
        value={draft}
        dir="ltr"
        onChange={(e) => setDraft(key, e.target.value)}
      />
      {parseErr && (
        <p className="text-xs text-red-600" dir="ltr">
          {parseErr}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <StateBadge state={state} isAr={isAr} />
        <Button
          size="sm"
          variant="outline"
          disabled={
            state === 'saving' ||
            !!parseErr ||
            JSON.stringify(parsed) === JSON.stringify(value)
          }
          onClick={() => {
            if (!parseErr) saveValue(key, parsed);
          }}
        >
          {isAr ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function StateBadge({ state, isAr }: { state: SaveState; isAr: boolean }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {isAr ? 'جارٍ الحفظ…' : 'Saving…'}
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        {isAr ? 'تم' : 'Saved'}
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <X className="h-3.5 w-3.5" />
        {isAr ? 'خطأ' : 'Error'}
      </span>
    );
  }
  return null;
}
