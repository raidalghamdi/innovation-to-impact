// Supervisor parity route — reuses the admin analytics view with a
// supervisor-scoped export screenId. Access is granted to admin AND supervisor
// (getCurrentUser promotes supervisor -> admin, and middleware allows the
// /supervisor prefix).
import { AnalyticsView } from '@/app/[locale]/admin/analytics/page';

export const dynamic = 'force-dynamic';

export default function SupervisorAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <AnalyticsView params={params} screenPrefix="supervisor" />;
}
