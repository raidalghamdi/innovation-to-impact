'use client';

// src/components/invitation-settings-form.tsx
// Form for admin_settings: reminder_schedule + invitation_defaults.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ReminderSchedule = {
  enabled?: boolean;
  cron?: string;
  timezone?: string;
  stop_after_n_reminders?: number;
  gap_hours?: number;
};

type InvitationDefaults = {
  expires_days?: number;
  from_name?: string;
  from_email?: string;
  program_name_ar?: string;
  program_name_en?: string;
};

type Props = {
  reminder: ReminderSchedule;
  defaults: InvitationDefaults;
  locale: 'ar' | 'en';
};

export function InvitationSettingsForm({ reminder, defaults, locale }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [r, setR] = useState<ReminderSchedule>({
    enabled: reminder.enabled ?? true,
    cron: reminder.cron ?? '0 9 * * 1',
    timezone: reminder.timezone ?? 'Asia/Riyadh',
    stop_after_n_reminders: reminder.stop_after_n_reminders ?? 3,
    gap_hours: reminder.gap_hours ?? 48,
  });
  const [d, setD] = useState<InvitationDefaults>({
    expires_days: defaults.expires_days ?? 14,
    from_name: defaults.from_name ?? 'Innovation-to-Impact Program',
    from_email: defaults.from_email ?? 'noreply@gac.gov.sa',
    program_name_ar: defaults.program_name_ar ?? 'برنامج ابتكر لمنافس',
    program_name_en: defaults.program_name_en ?? 'Innovation-to-Impact Program',
  });

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/invitations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_schedule: r,
          invitation_defaults: d,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save-failed');
      showToast('ok', isAr ? 'حُفظت الإعدادات.' : 'Settings saved.');
      router.refresh();
    } catch (e: any) {
      showToast('err', e.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {toast && (
        <div
          className={`fixed top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            isAr ? 'left-4' : 'right-4'
          } ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {isAr ? 'التذكيرات الآلية' : 'Automatic Reminders'}
          </h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => setR({ ...r, enabled: e.target.checked })}
            />
            <span>{isAr ? 'تفعيل التذكيرات الآلية' : 'Enable automatic reminders'}</span>
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cron">{isAr ? 'الجدولة (Cron)' : 'Schedule (cron)'}</Label>
              <Input
                id="cron"
                value={r.cron}
                onChange={(e) => setR({ ...r, cron: e.target.value })}
                placeholder="0 9 * * 1"
                className="font-mono"
              />
              <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3 w-3 flex-none" />
                <span>
                  {isAr
                    ? 'مثال: 0 9 * * 1 = كل إثنين الساعة 9 صباحاً.'
                    : 'e.g. 0 9 * * 1 = every Monday at 09:00.'}
                </span>
              </p>
            </div>
            <div>
              <Label htmlFor="tz">{isAr ? 'المنطقة الزمنية' : 'Timezone'}</Label>
              <Input
                id="tz"
                value={r.timezone}
                onChange={(e) => setR({ ...r, timezone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="stop">
                {isAr ? 'الحد الأقصى للتذكيرات' : 'Max reminders per invitation'}
              </Label>
              <Input
                id="stop"
                type="number"
                min={0}
                max={10}
                value={r.stop_after_n_reminders}
                onChange={(e) =>
                  setR({ ...r, stop_after_n_reminders: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="gap">
                {isAr ? 'الفاصل بين التذكيرات (ساعات)' : 'Gap between reminders (hours)'}
              </Label>
              <Input
                id="gap"
                type="number"
                min={1}
                value={r.gap_hours}
                onChange={(e) => setR({ ...r, gap_hours: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {isAr ? 'إعدادات المرسل الافتراضية' : 'Default sender & program info'}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="expd">{isAr ? 'مدة صلاحية الدعوة (أيام)' : 'Expires after (days)'}</Label>
              <Input
                id="expd"
                type="number"
                min={1}
                value={d.expires_days}
                onChange={(e) => setD({ ...d, expires_days: Number(e.target.value) || 1 })}
              />
            </div>
            <div />
            <div>
              <Label htmlFor="fname">{isAr ? 'اسم المرسل' : 'From name'}</Label>
              <Input
                id="fname"
                value={d.from_name}
                onChange={(e) => setD({ ...d, from_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="fmail">{isAr ? 'بريد المرسل' : 'From email'}</Label>
              <Input
                id="fmail"
                type="email"
                value={d.from_email}
                onChange={(e) => setD({ ...d, from_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="par">{isAr ? 'اسم البرنامج (عربي)' : 'Program name (AR)'}</Label>
              <Input
                id="par"
                dir="rtl"
                value={d.program_name_ar}
                onChange={(e) => setD({ ...d, program_name_ar: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pen">{isAr ? 'اسم البرنامج (إنجليزي)' : 'Program name (EN)'}</Label>
              <Input
                id="pen"
                value={d.program_name_en}
                onChange={(e) => setD({ ...d, program_name_en: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
