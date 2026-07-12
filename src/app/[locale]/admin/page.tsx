import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/user';
import { MyEscalationsStrip } from '@/components/my-escalations-strip';
import {
  Users as UsersIcon,
  Shapes,
  Upload,
  BarChart3,
  Database,
  SlidersHorizontal,
  FileBarChart,
  ShieldCheck,
  Split as SplitIcon,
  ClipboardEdit,
  ClipboardList,
  FileText,
  FileDown,
  CalendarClock,
  MailPlus,
  UserPlus,
  Bell,
  Inbox,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { ResendStatusCard } from '@/components/resend-status-card';

/**
 * /admin — Admin Hub.
 *
 * This is the LANDING page for administrators. Instead of dumping the users
 * table + audit log inline (the previous design), every admin capability now
 * lives as its own card that links out to a dedicated sub-page. The result:
 *   - Backup, phase scheduling, and other previously "hidden" features are
 *     discoverable from a single glance.
 *   - Users / audit tables are moved into /admin/users and /admin/audit
 *     respectively (they already exist there).
 *   - The layout is fully responsive (2 cols mobile → 3 tablet → 4 desktop).
 *
 * Escalation strip stays at the top so admins never miss items requiring
 * their action.
 */
type AdminCard = {
  href: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  icon: LucideIcon;
};

const ADMIN_CARDS: AdminCard[] = [
  {
    href: '/admin/users',
    labelAr: 'إدارة المستخدمين',
    labelEn: 'User Management',
    descAr: 'إضافة، تعديل، وتعطيل حسابات المستخدمين.',
    descEn: 'Add, edit, and disable user accounts.',
    icon: UsersIcon,
  },
  {
    href: '/admin/roles',
    labelAr: 'كتالوج الأدوار',
    labelEn: 'Roles Catalog',
    descAr: 'تعريف الأدوار وصلاحياتها في المنصة.',
    descEn: 'Define roles and their permissions.',
    icon: Shapes,
  },
  {
    href: '/admin/roster',
    labelAr: 'قائمة المستخدمين',
    labelEn: 'Roster',
    descAr: 'عرض شامل لجميع المستخدمين والأدوار.',
    descEn: 'Comprehensive view of all users and roles.',
    icon: ClipboardList,
  },
  {
    href: '/admin/invitation-settings',
    labelAr: 'الأدوار والدعوات',
    labelEn: 'Roles & Invitations',
    descAr: 'إعدادات الدعوات، القنوات، والصلاحيات.',
    descEn: 'Invitation channels, quotas, and permissions.',
    icon: UserPlus,
  },
  {
    href: '/admin/invitation-templates',
    labelAr: 'قوالب الدعوات',
    labelEn: 'Invitation Templates',
    descAr: 'تصميم وإدارة قوالب رسائل الدعوة.',
    descEn: 'Design and manage invitation message templates.',
    icon: MailPlus,
  },
  {
    href: '/admin/employees/import',
    labelAr: 'استيراد الموظفين',
    labelEn: 'Employees Import',
    descAr: 'رفع ملف الموظفين لإنشاء الحسابات دفعة واحدة.',
    descEn: 'Bulk-create accounts from an employee spreadsheet.',
    icon: Upload,
  },
  {
    href: '/admin/analytics',
    labelAr: 'التحليلات',
    labelEn: 'Analytics',
    descAr: 'مؤشرات الأداء، الاتجاهات، والتقارير التنفيذية.',
    descEn: 'KPIs, trends, and executive reporting.',
    icon: BarChart3,
  },
  {
    href: '/admin/backup',
    labelAr: 'النسخ الاحتياطي',
    labelEn: 'Backup & Restore',
    descAr: 'تنزيل بيانات المنصة كملف Excel واستعادتها لاحقاً.',
    descEn: 'Download the full database as Excel and restore later.',
    icon: Database,
  },
  {
    href: '/admin/phases',
    labelAr: 'جدولة المراحل',
    labelEn: 'Phase Scheduling',
    descAr: 'تحديد تواريخ فتح وإغلاق كل مرحلة من المراحل السبع.',
    descEn: 'Set open/close dates for each of the seven phases.',
    icon: CalendarClock,
  },
  {
    href: '/admin/settings',
    labelAr: 'إعدادات المنصة',
    labelEn: 'Platform Settings',
    descAr: 'المفاتيح العامة: النطاقات، البريد، OTP، إعدادات النظام.',
    descEn: 'Global toggles: domains, email, OTP, system settings.',
    icon: SlidersHorizontal,
  },
  {
    href: '/admin/audit',
    labelAr: 'سجلات التدقيق',
    labelEn: 'Audit Logs',
    descAr: 'سجل تفصيلي لكل إجراء في المنصة.',
    descEn: 'A detailed log of every action taken on the platform.',
    icon: FileBarChart,
  },
  {
    href: '/admin/compliance',
    labelAr: 'المعايير والامتثال',
    labelEn: 'Standards & Compliance',
    descAr: 'ضوابط الامتثال التنظيمية (DGA/NCA/SDAIA/WCAG) وحالتها.',
    descEn: 'Regulatory compliance controls (DGA/NCA/SDAIA/WCAG) and their status.',
    icon: ShieldCheck,
  },
  {
    href: '/admin/escalations',
    labelAr: 'الترقيات والاعتراضات',
    labelEn: 'Escalations & Approvals',
    descAr: 'مراجعة اعتراضات المستخدمين وقرارات التصعيد.',
    descEn: 'Review user objections and escalation decisions.',
    icon: ShieldCheck,
  },
  {
    href: '/admin/assignments',
    labelAr: 'التعيينات',
    labelEn: 'Assignments',
    descAr: 'توزيع المُقيِّمين على الأفكار وإدارة أعباء العمل.',
    descEn: 'Assign evaluators to ideas and balance workloads.',
    icon: SplitIcon,
  },
  {
    href: '/admin/change-requests',
    labelAr: 'طلبات التعديل',
    labelEn: 'Change Requests',
    descAr: 'مراجعة طلبات تعديل الأفكار بعد الإرسال.',
    descEn: 'Review post-submission idea change requests.',
    icon: ClipboardEdit,
  },
  {
    href: '/admin/cms',
    labelAr: 'محرر المحتوى',
    labelEn: 'Content Editor',
    descAr: 'تعديل نصوص وصور وفيديو المنصة بدون كود.',
    descEn: 'Edit platform text, images, and video — no code.',
    icon: FileText,
  },
  {
    href: '/admin/terms',
    labelAr: 'الشروط والأحكام',
    labelEn: 'Terms & Conditions',
    descAr: 'تحرير محتوى صفحة الشروط والأحكام (عربي/إنجليزي).',
    descEn: 'Edit the public Terms & Conditions page (Arabic/English).',
    icon: FileText,
  },
  {
    href: '/admin/reports',
    labelAr: 'مركز التقارير',
    labelEn: 'Reports Center',
    descAr: '12 تقريراً بصيغ PDF/Excel/PowerPoint مع تحميل مباشر أو إرسال بالبريد.',
    descEn: '12 report types in PDF/Excel/PowerPoint with direct download or email delivery.',
    icon: FileDown,
  },
  {
    href: '/admin/support',
    labelAr: 'صندوق الدعم',
    labelEn: 'Support Inbox',
    descAr: 'الرسائل الواردة من نموذج الدعم ومتابعة معالجتها.',
    descEn: 'Incoming support-form messages and their handling status.',
    icon: Inbox,
  },
  {
    href: '/notifications',
    labelAr: 'الإشعارات',
    labelEn: 'Notifications',
    descAr: 'إعدادات الإشعارات وسجل التنبيهات.',
    descEn: 'Notification settings and alert history.',
    icon: Bell,
  },
];

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const user = await getCurrentUser();

  const isAr = locale === 'ar';
  const ChevronIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'لوحة الإدارة' : 'Admin Hub'}
        subtitle={
          isAr
            ? 'كل ما تحتاجه لإدارة المنصة في مكان واحد. اختر القسم للانتقال إليه.'
            : 'Everything you need to manage the platform in one place. Pick a section to jump in.'
        }
      />

      {user && (
        <MyEscalationsStrip userId={user.id} role={user.role} locale={locale} />
      )}

      {/* S3-09 — read-only health status: is transactional email configured? */}
      <ResendStatusCard
        configured={Boolean(process.env.RESEND_API_KEY)}
        locale={locale}
      />

      <div
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="list"
      >
        {ADMIN_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href as any}
              role="listitem"
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 rounded-xl"
            >
              <Card className="h-full border-border bg-card transition group-hover:border-brand-teal group-hover:shadow-md group-focus-visible:border-brand-teal">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal-light/60 text-brand-teal transition group-hover:bg-brand-teal group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <ChevronIcon
                      className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {isAr ? card.labelAr : card.labelEn}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {isAr ? card.descAr : card.descEn}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {isAr
          ? 'هل تحتاج قدرة إضافية غير موجودة أعلاه؟ تواصل مع فريق المنصة.'
          : 'Need a capability not shown above? Contact the platform team.'}
      </p>
    </AppShell>
  );
}
