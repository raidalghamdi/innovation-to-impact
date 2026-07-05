import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { IdeasExplorer } from '@/components/ideas-explorer';
import { fetchIdeas, fetchThemes, fetchActivities } from '@/lib/data';
import { getCurrentUser } from '@/lib/user';
import { createClient } from '@/lib/supabase/server';
import { Plus } from 'lucide-react';

// Role-based visibility for the ideas list:
//   submitter → own ideas + ideas submitted by their team
//   evaluator → only ideas assigned to them for evaluation
//   judge     → only finalists/winners (committee stage or approved+)
//   admin     → everything (no filtering)
async function scopeIdeasByRole(
  ideas: Awaited<ReturnType<typeof fetchIdeas>>
): Promise<Awaited<ReturnType<typeof fetchIdeas>>> {
  const user = await getCurrentUser();
  if (!user || user.role === 'admin') return ideas;

  if (user.role === 'submitter') {
    let teamId: string | null = null;
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .maybeSingle();
        teamId = (data as { team_id?: string } | null)?.team_id ?? null;
      }
    } catch {
      // team lookup best-effort; fall back to own ideas only.
    }
    return ideas.filter(
      (i: any) => i.submitter_id === user.id || (teamId && i.team_id === teamId)
    );
  }

  if (user.role === 'evaluator') {
    let assignedIds = new Set<string>();
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase
          .from('assignments')
          .select('idea_id')
          .eq('evaluator_id', user.id);
        assignedIds = new Set((data ?? []).map((r: any) => r.idea_id));
      }
    } catch {
      // no assignments table access → show nothing rather than everything.
    }
    return ideas.filter((i: any) => assignedIds.has(i.id));
  }

  if (user.role === 'judge') {
    const FINALIST_STATUSES = new Set(['committee', 'approved', 'assigned', 'in_pilot', 'in_implementation', 'benefits_tracking', 'closed']);
    return ideas.filter((i: any) => FINALIST_STATUSES.has(i.status));
  }

  return ideas;
}

export default async function IdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const [allIdeas, themes, activities] = await Promise.all([
    fetchIdeas(),
    fetchThemes(),
    fetchActivities(),
  ]);
  const ideas = await scopeIdeasByRole(allIdeas);

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button asChild variant="gold">
            <Link href="/ideas/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <IdeasExplorer ideas={ideas} themes={themes} activities={activities} locale={locale} />
    </AppShell>
  );
}
