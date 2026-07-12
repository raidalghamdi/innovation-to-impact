// Supervisor parity route — reuses the admin page component verbatim.
// Access is granted to admin AND supervisor (getCurrentUser promotes
// supervisor -> admin, and middleware allows the /supervisor prefix).
export { default } from '@/app/[locale]/admin/phases/page';
export const dynamic = 'force-dynamic';
