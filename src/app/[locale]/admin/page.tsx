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
    descAr: 'بحث وإدارة الحسابات: تعديل البيانات، الأدوار، تصفير كلمة المرور، وتفعيل/تعطيل.',
    descEn: 'Search and manage accounts: edit profiles, roles, password resets, and activate/deactivate.',
    icon: UsersIcon,
  },
  {
    href: '/admin/roles',
    labelAr: 'كتالوج الأدوار',
    labelEn: 'Roles Catalog',
    descAr: 'كتالوج الأدوار: الرمز، الأسماء، الوصف، والترتيب — مع إضافة وتعديل الأدوار المخصصة.',
    descEn: 'Role catalog: code, names, description, and order — add and edit custom roles.',
    icon: Shapes,
  },
  {
    href: '/admin/roster',
    labelAr: 'قائمة المستخدمين',
    labelEn: 'Roster',
    descAr: 'بطاقات لكل دور مع أعداد الأعضاء والدعوات، وروابط لتفاصيل كل دور.',
    descEn: 'Per-role cards with member and invitation counts, linking to each role\'s detail.',
    icon: ClipboardList,
  },
  {
    href: '/admin/invitation-settings',
    labelAr: 'الأدوار والدعوات',
    labelEn: 'Roles & Invitations',
    descAr: 'إرسال الدعوات دفعةً واحدة وضبط التذكيرات ومدة الصلاحية والمُرسِل واسم البرنامج.',
    descEn: 'Send bulk invitations and configure reminders, expiry, sender defaults, and program name.',
    icon: UserPlus,
  },
  {
    href: '/admin/invitation-templates',
    labelAr: 'قوالب الدعوات',
    labelEn: 'Invitation Templates',
    descAr: 'تحرير قوالب الدعوة (العنوان والنص بالعربية والإنجليزية) لكل دور، مع المرفقات والإرسال.',
    descEn: 'Edit invitation templates (subject and body, AR+EN) per role, with attachments and sending.',
    icon: MailPlus,
  },
  {
    href: '/admin/employees/import',
    labelAr: 'استيراد الموظفين',
    labelEn: 'Employees Import',
    descAr: 'رفع ملف Excel/CSV مع معاينة والتحقق من كل صف قبل إنشاء الحسابات دفعةً واحدة.',
    descEn: 'Upload an Excel/CSV file with per-row validation preview, then bulk-create accounts.',
    icon: Upload,
  },
  {
    href: '/admin/analytics',
    labelAr: 'التحليلات',
    labelEn: 'Analytics',
    descAr: 'بطاقات مؤشرات ورسوم للأفكار حسب المرحلة والتحويل والزمن، مع القمع والمسارات وجداول المقيّمين.',
    descEn: 'KPI cards and charts for ideas by stage, conversion, and timing, plus funnel, cohort, and evaluator tables.',
    icon: BarChart3,
  },
  {
    href: '/admin/backup',
    labelAr: 'النسخ الاحتياطي',
    labelEn: 'Backup & Restore',
    descAr: 'تصدير قاعدة البيانات إلى Excel واستيرادها لاحقاً — محميّة بكلمة مرور مع ملخّص للاستيراد.',
    descEn: 'Export the database to Excel and re-import later — password-gated, with an import summary.',
    icon: Database,
  },
  {
    href: '/admin/phases',
    labelAr: 'جدولة المراحل',
    labelEn: 'Phase Scheduling',
    descAr: 'ضبط تواريخ فتح وإغلاق المراحل السبع، وإدارة المسارات الاستراتيجية (إضافة وتعديل وحذف).',
    descEn: 'Set open/close dates for the seven phases, and manage strategic tracks (add, edit, delete).',
    icon: CalendarClock,
  },
  {
    href: '/admin/settings',
    labelAr: 'إعدادات المنصة',
    labelEn: 'Platform Settings',
    descAr: 'إعدادات مُجمّعة حسب الفئة (النطاقات، المصادقة، عامة) مع حفظ كل إعداد على حدة.',
    descEn: 'Settings grouped by category (domains, auth, general) with per-setting save.',
    icon: SlidersHorizontal,
  },
  {
    href: '/admin/audit',
    labelAr: 'سجلات التدقيق',
    labelEn: 'Audit Logs',
    descAr: 'سجل مُفلتَر (النوع، الإجراء، الفاعل، التاريخ) لكل إجراء، مع ترقيم صفحات وشارة تحقّق.',
    descEn: 'Filterable log (entity, action, actor, date) of every action, with pagination and a verification badge.',
    icon: FileBarChart,
  },
  {
    href: '/admin/compliance',
    labelAr: 'المعايير والامتثال',
    labelEn: 'Standards & Compliance',
    descAr: 'جدول للقراءة فقط بضوابط الامتثال (DGA/NCA/SDAIA/WCAG) وحالتها والميزات المرتبطة.',
    descEn: 'Read-only table of compliance controls (DGA/NCA/SDAIA/WCAG) with status and linked features.',
    icon: ShieldCheck,
  },
  {
    href: '/admin/escalations',
    labelAr: 'الترقيات والاعتراضات',
    labelEn: 'Escalations & Approvals',
    descAr: 'تصفية ومتابعة العناصر المتصعّدة حسب الحالة والمستوى، مع الاطّلاع والتصعيد والحل.',
    descEn: 'Filter and track escalated items by status and level, with acknowledge, bump, and resolve actions.',
    icon: ShieldCheck,
  },
  {
    href: '/admin/assignments',
    labelAr: 'التعيينات',
    labelEn: 'Assignments',
    descAr: 'خريطة أعباء المُقيِّمين وجدول التعيينات مع الفلترة، وإعادة الإسناد، والحذف الجماعي.',
    descEn: 'Evaluator workload heatmap and assignments table with filters, reassignment, and bulk delete.',
    icon: SplitIcon,
  },
  {
    href: '/admin/cms',
    labelAr: 'محرر المحتوى',
    labelEn: 'Content Editor',
    descAr: 'تبويبان لتحرير نصوص وأقسام المنصة ووسائطها (الصور والفيديو) مباشرةً بدون كود.',
    descEn: 'Two tabs to edit platform text/sections and media (images and video) in-place — no code.',
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
    descAr: 'لوحة رسوم قابلة للعنونة و12 نوع تقرير بصيغ PDF/Excel/PowerPoint مع تحميل أو إرسال بالبريد.',
    descEn: 'Editable charts dashboard plus 12 report types in PDF/Excel/PowerPoint with download or email delivery.',
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
    descAr: 'قائمة الإشعارات مع تصفية (الكل/غير المقروء) ووضع علامة مقروء أو حذف، وتحديث فوري.',
    descEn: 'Notifications list with all/unread filter, mark-as-read and delete, and real-time updates.',
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
