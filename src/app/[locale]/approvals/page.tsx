import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { getPendingApprovals } from '@/lib/approvals';
import { createClient } from '@/lib/supabase/server';
import { fetchIdeas } from '@/lib/data';
import { pick } from '@/lib/i18n-content';
import { ApprovalQueue, type ApprovalCard } from '@/components/approval-queue';

export const dynamic = 'force-dynamic';

async function chainNameMap(locale: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const map = new Map<string, string>();
  if (!supabase) return map;
  const { data } = await supabase.from('approval_chains').select('id, name_ar, name_en');
  for (const c of (data as { id: string; name_ar: string | null; name_en: string | null }[] | null) ?? []) {
    const name = pick(c.name_ar, c.name_en, locale);
    if (name) map.set(c.id, name);
  }
  return map;
}

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('approvals');

  const user = await getCurrentUser();
  const pending = user ? await getPendingApprovals(user.id) : [];

  const [chains, ideas] = await Promise.all([chainNameMap(locale), fetchIdeas()]);
  const ideaTitleById = new Map(
    ideas.map((i) => [i.id, pick(i.title_ar, i.title_en, locale) ?? i.code])
  );

  const cards: ApprovalCard[] = pending.map((p) => {
    const entityLabel =
      p.entityType === 'idea'
        ? ideaTitleById.get(p.entityId) ?? `${p.entityId.slice(0, 8)}`
        : `${t(`entity.${p.entityType}`)} · ${p.entityId.slice(0, 8)}`;
    return {
      instanceId: p.instanceId,
      stepId: p.step.id,
      entityType: p.entityType,
      entityLabel,
      chainName: chains.get(p.chainId) ?? null,
      stepLabel: pick(p.step.label_ar, p.step.label_en, locale),
      stepOrder: p.step.step_order,
      minApprovers: p.step.min_approvers,
      priorApprovers: p.priorApprovers,
    };
  });

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ApprovalQueue initial={cards} />
    </AppShell>
  );
}
