// Supervisor parity route — reuses the admin escalations view with a
// supervisor-scoped export screenId. Access is granted to admin AND supervisor
// (getCurrentUser promotes supervisor -> admin, and middleware allows the
// /supervisor prefix).
import { EscalationsView } from '@/app/[locale]/admin/escalations/page';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default function SupervisorEscalationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return <EscalationsView params={params} searchParams={searchParams} screenPrefix="supervisor" />;
}
