import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getEscalationsForUser } from '@/lib/escalations';
import { pick } from '@/lib/i18n-content';
import type { Role } from '@/lib/roles';

const LEVEL_TONE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-700',
};

// Compact "My escalations" strip for the admin/judge dashboards. Judges only see
// director/exec-level items (level ≥ 2); admins see everything assigned to them.
// Renders nothing when there is nothing to show, so it stays out of the way.
export async function MyEscalationsStrip({
  userId,
  role,
  locale,
}: {
  userId: string;
  role: Role;
  locale: string;
}) {
  if (role !== 'admin' && role !== 'judge') return null;

  const all = await getEscalationsForUser(userId);
  const items = role === 'judge' ? all.filter((e) => e.current_level >= 2) : all;
  if (!items.length) return null;

  const t = await getTranslations('escalations');

  return (
    <Card className="mb-6 border-amber-200">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold">{t('mine')}</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 tabular-nums">
            {items.length}
          </span>
          <Link
            href="/admin/escalations"
            className="ms-auto text-xs text-brand-teal hover:underline"
          >
            {t('viewAll')}
          </Link>
        </div>
        <ul className="space-y-2">
          {items.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_TONE[e.current_level] ?? LEVEL_TONE[1]}`}
              >
                {t(`level.${e.current_level}`)}
              </span>
              <span className="font-medium">{t(`entity.${e.entity_type}`)}</span>
              <span className="truncate text-muted-foreground">
                {pick(e.reason_ar, e.reason_en, locale) ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
