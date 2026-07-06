'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getRoleIcon } from '@/lib/role-icons';
import { Check } from 'lucide-react';

type RoleOpt = { id: string; code: string; name_ar: string; name_en: string };
type Assigned = { roleId: string; isPrimary: boolean };

// src/components/user-role-editor-client.tsx:1
// Phase 11.3 — checkbox-per-role + single primary radio, PATCH on save.
export function UserRoleEditorClient({
  userId,
  locale,
  allRoles,
  initialAssigned,
}: {
  userId: string;
  locale: string;
  allRoles: RoleOpt[];
  initialAssigned: Assigned[];
}) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set(initialAssigned.map((a) => a.roleId)));
  const [primary, setPrimary] = useState<string | null>(
    initialAssigned.find((a) => a.isPrimary)?.roleId ?? initialAssigned[0]?.roleId ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(roleId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
        if (primary === roleId) {
          const remaining = Array.from(next);
          setPrimary(remaining[0] ?? null);
        }
      } else {
        next.add(roleId);
        if (!primary) setPrimary(roleId);
      }
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: Array.from(checked), primaryRoleId: primary }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-1 p-4 sm:p-6">
        <p className="mb-3 text-sm font-medium text-foreground">
          {isAr ? 'الأدوار المسندة' : 'Assigned roles'}
        </p>
        <div className="space-y-2">
          {allRoles.map((role) => {
            const Icon = getRoleIcon(role.code);
            const isChecked = checked.has(role.id);
            return (
              <div
                key={role.id}
                className={`flex flex-col gap-2 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                  isChecked ? 'border-brand-teal/40 bg-brand-teal-light/30' : 'border-border'
                }`}
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(role.id)}
                    className="h-4 w-4 rounded border-border text-brand-teal focus:ring-brand-teal"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-brand-teal" />
                  <span className="text-sm font-medium text-foreground">
                    {isAr ? role.name_ar : role.name_en}
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2 ps-7 text-xs sm:ps-0 ${
                    isChecked ? 'text-muted-foreground' : 'pointer-events-none opacity-40'
                  }`}
                >
                  <input
                    type="radio"
                    name="primary-role"
                    checked={primary === role.id}
                    disabled={!isChecked}
                    onChange={() => setPrimary(role.id)}
                    className="h-4 w-4 border-border text-brand-teal focus:ring-brand-teal"
                  />
                  {isAr ? 'أساسي' : 'Primary'}
                </label>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isAr ? 'حفظ' : 'Save'}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-brand-teal">
              <Check className="h-4 w-4" />
              {isAr ? 'تم الحفظ' : 'Saved'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
