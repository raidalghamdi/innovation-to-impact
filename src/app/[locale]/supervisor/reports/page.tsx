// Supervisor parity route — reuses the admin reports view with a
// supervisor-scoped export screenId. Access is granted to admin AND supervisor
// (getCurrentUser promotes supervisor -> admin, and middleware allows the
// /supervisor prefix).
import { ReportsView } from '@/app/[locale]/admin/reports/page';

export const dynamic = 'force-dynamic';

export default function SupervisorReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <ReportsView params={params} screenPrefix="supervisor" />;
}
