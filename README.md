<div align="center">

# Innovation-to-Impact Platform
### منصة الابتكار إلى الأثر

**General Authority for Competition (GAC) — الهيئة العامة للمنافسة**

A government-grade, fully bilingual (Arabic / English, RTL / LTR) platform that manages the full innovation lifecycle — from strategy and idea capture through evaluation, piloting, implementation, benefits realization, and regulatory compliance.

</div>

---

> **English** below. **العربية** في الأسفل.

---

## 🇬🇧 English

### Overview

The Innovation-to-Impact Platform is an enterprise web application built for the **General Authority for Competition (GAC)** to govern the complete journey of an innovation idea across **eight structured stages**. It captures ideas, links them to strategic themes and activities, runs structured multi-evaluator scoring, supports committee decisions, manages pilots and full implementation, tracks realized benefits and funding, registers intellectual property, and maintains a complete regulatory compliance register aligned to Saudi national frameworks (SDAIA/NDMO, NCA, DGA, CST, RDIA).

The interface is fully bilingual with a live Arabic ⇄ English toggle and complete right-to-left (RTL) / left-to-right (LTR) layout mirroring. The design language is clean, professional, and government-grade — no gradients, no decorative clutter — using GAC's teal, gold, and cream palette.

### The Eight Stages

| # | Stage | Route | Purpose |
|---|-------|-------|---------|
| 1 | **Strategy & Themes** | `/strategy` | Strategic themes and innovation activities that ideas align to |
| 2 | **Ideas** | `/ideas` | Capture, explore, filter, and migrate ideas; per-idea detail views |
| 3 | **Evaluation** | `/evaluation` | Structured multi-criteria scorecards by assigned evaluators |
| 4 | **Committee** | `/committee` | Committee decisions (approve / reject / defer) on evaluated ideas |
| 5 | **Pilots** | `/pilots` | Pilot definition, execution, and scale decisions |
| 6 | **Implementation** | `/implementation` | Full rollout tracking of scaled ideas |
| 7 | **Benefits & Funding** | `/benefits`, `/funding` | Realized benefits, KPIs, and funding allocation |
| 8 | **IP & Knowledge** | `/ip`, `/knowledge` | Intellectual-property registration and a knowledge repository |

Supporting modules: **Dashboard** (`/dashboard`), **Compliance Register** (`/compliance`), **Analytics** (`/analytics`), **Admin** (`/admin`), and **Settings** (`/settings`).

### Features

- **Full bilingual UI** — Arabic and English with a live toggle; full RTL/LTR mirroring driven by `next-intl`.
- **Eight-stage innovation lifecycle** — each stage has a dedicated, data-connected view.
- **Strategic alignment** — ideas link to themes and activities for traceability from strategy to impact.
- **Multi-evaluator scorecards** — structured, criteria-based evaluation workflow.
- **Committee governance** — decision capture with status tracking.
- **Pilot → scale → implementation** progression with explicit scale decisions.
- **Benefits realization & funding** tracking with KPIs.
- **IP register** and a searchable **knowledge repository**.
- **Regulatory compliance register** aligned to **SDAIA/NDMO**, **NCA (ECC)**, **DGA**, **CST**, and **RDIA** frameworks with authentic control clauses.
- **Role-based access** — admin, evaluators, idea owners, and committee members, enforced via Supabase Row Level Security.
- **Government-grade design system** — teal `#01696F`, gold `#C8A23A`, cream `#F7F5EF`, ink `#1F2937`; IBM Plex Sans Arabic + Inter typefaces; no gradients or decorative icons.
- **Demo-data fallback** — the app renders meaningful sample data even without a live database, so previews and builds always succeed.

### Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui primitives
- **Internationalization:** `next-intl` (AR/EN, RTL/LTR)
- **Database & Auth:** Supabase (PostgreSQL + Auth) using **`@supabase/ssr`**
- **Icons:** lucide-react
- **Deployment:** Vercel

### Local Setup

**Prerequisites:** Node.js 18.17+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.local.example .env.local
# then fill in your Supabase values (see "Environment Variables" below)

# 3. Run the development server
npm run dev
# open http://localhost:3000  (redirects to /ar by default)

# 4. Production build
npm run build
npm run start
```

> **Note:** If you do not configure Supabase env vars, the app automatically falls back to bundled demo data (`src/lib/demo-data.ts`), so it runs and builds with zero configuration.

### Environment Variables

Create `.env.local` from `.env.local.example`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client-side access |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for privileged server-side operations |

### Supabase Setup

1. Create a new Supabase project.
2. Apply the migrations, in order, from the SQL editor or the Supabase CLI:
   - `supabase/migrations/00001_initial_schema.sql` — 18 tables, enums, RLS policies, triggers, the `is_admin()` helper, and the `handle_new_user()` trigger.
   - `supabase/migrations/00002_seed_data.sql` — sample data: 8 users, 3 themes, 2 activities, 15 ideas, evaluations, decisions, pilots, benefits, funding, IP records, knowledge entries, 15 compliance controls, and notifications.
3. Both migrations are **idempotent** (`ON CONFLICT DO NOTHING`, `IF NOT EXISTS`), so they can be re-applied safely.
4. Copy your project URL and keys into `.env.local`.

> **Seed note:** The seed migration temporarily relaxes the `user_profiles` foreign key so demo profiles can exist without `auth.users` rows. In production, real users are created through Supabase Auth and the `handle_new_user()` trigger populates their profile automatically.

### Vercel Deployment

1. Push the repository to GitHub.
2. Import the project into Vercel (it auto-detects Next.js).
3. Add the three environment variables above in **Project Settings → Environment Variables**.
4. Deploy. The default build command (`next build`) and output are used as-is.

### Project Structure

```
innovation-to-impact/
├── messages/                # AR/EN translation catalogs (ar.json, en.json)
├── middleware.ts            # next-intl locale routing + Supabase session
├── supabase/migrations/     # 00001 schema, 00002 seed (idempotent)
├── src/
│   ├── app/[locale]/        # all localized routes (ar + en)
│   ├── components/          # UI primitives + feature components
│   ├── i18n/                # routing + request config
│   └── lib/                 # supabase clients, data layer, demo data, utils
├── tailwind.config.ts       # GAC brand tokens
└── .env.local.example       # environment template
```

### Screenshots

QA screenshots are included in the project root: `qa_ar_landing.png`, `qa_en_dashboard.png`, `qa_ar_compliance.png` — demonstrating RTL Arabic, LTR English, and the compliance register.

---

## 🇸🇦 العربية

### نظرة عامة

**منصة الابتكار إلى الأثر** هي تطبيق ويب مؤسسي بُني لصالح **الهيئة العامة للمنافسة** لإدارة رحلة الفكرة الابتكارية الكاملة عبر **ثماني مراحل منظمة**. تلتقط المنصة الأفكار، وتربطها بالمحاور الاستراتيجية والأنشطة، وتُجري تقييماً متعدد المُقيِّمين وفق معايير محددة، وتدعم قرارات اللجان، وتدير المشاريع التجريبية والتنفيذ الكامل، وتتتبع المنافع المتحققة والتمويل، وتسجّل الملكية الفكرية، وتحتفظ بسجل امتثال تنظيمي كامل متوافق مع الأطر الوطنية السعودية (سدايا/المكتب الوطني لإدارة البيانات، الهيئة الوطنية للأمن السيبراني، هيئة الحكومة الرقمية، هيئة الاتصالات والفضاء والتقنية، صندوق البحث والتطوير والابتكار).

الواجهة ثنائية اللغة بالكامل مع مُبدِّل فوري بين العربية والإنجليزية، ودعم كامل لاتجاه الكتابة من اليمين إلى اليسار (RTL) ومن اليسار إلى اليمين (LTR). لغة التصميم نظيفة واحترافية وبمستوى حكومي — دون تدرجات لونية أو زخارف — باستخدام ألوان الهيئة: الفيروزي والذهبي والكريمي.

### المراحل الثماني

| # | المرحلة | المسار |
|---|---------|--------|
| ١ | **الاستراتيجية والمحاور** | `/strategy` |
| ٢ | **الأفكار** | `/ideas` |
| ٣ | **التقييم** | `/evaluation` |
| ٤ | **اللجنة** | `/committee` |
| ٥ | **المشاريع التجريبية** | `/pilots` |
| ٦ | **التنفيذ** | `/implementation` |
| ٧ | **المنافع والتمويل** | `/benefits`, `/funding` |
| ٨ | **الملكية الفكرية والمعرفة** | `/ip`, `/knowledge` |

وحدات مساندة: **لوحة المعلومات** (`/dashboard`)، **سجل الامتثال** (`/compliance`)، **التحليلات** (`/analytics`)، **الإدارة** (`/admin`)، و**الإعدادات** (`/settings`).

### المزايا

- **واجهة ثنائية اللغة كاملة** — العربية والإنجليزية مع مُبدِّل فوري ودعم كامل لاتجاهي RTL/LTR عبر `next-intl`.
- **دورة ابتكار من ثماني مراحل** — لكل مرحلة واجهة مخصصة متصلة بالبيانات.
- **المواءمة الاستراتيجية** — ربط الأفكار بالمحاور والأنشطة لتتبّع المسار من الاستراتيجية إلى الأثر.
- **بطاقات تقييم متعددة المُقيِّمين** وفق معايير منظمة.
- **حوكمة اللجان** مع تتبّع حالة القرارات.
- **مسار المشروع التجريبي ← التوسّع ← التنفيذ** مع قرارات توسّع واضحة.
- **تتبّع المنافع المتحققة والتمويل** مع مؤشرات الأداء.
- **سجل الملكية الفكرية** ومستودع معرفة قابل للبحث.
- **سجل امتثال تنظيمي** متوافق مع أطر **سدايا/NDMO** و**NCA (ECC)** و**DGA** و**CST** و**RDIA** ببنود ضوابط موثوقة.
- **صلاحيات قائمة على الأدوار** — المسؤول، المُقيِّمون، أصحاب الأفكار، وأعضاء اللجنة، مُطبَّقة عبر سياسات أمان الصفوف في Supabase.
- **نظام تصميم بمستوى حكومي** — فيروزي `#01696F`، ذهبي `#C8A23A`، كريمي `#F7F5EF`، حبري `#1F2937`؛ خطوط IBM Plex Sans Arabic و Inter؛ دون تدرجات أو أيقونات زخرفية.
- **بيانات تجريبية احتياطية** — يعرض التطبيق بيانات نموذجية حتى دون قاعدة بيانات فعلية، لضمان نجاح المعاينات وعمليات البناء دائماً.

### الحزمة التقنية

- **إطار العمل:** Next.js 14 (App Router) + TypeScript
- **التنسيق:** Tailwind CSS + مكوّنات shadcn/ui
- **التعريب:** `next-intl` (عربي/إنجليزي، RTL/LTR)
- **قاعدة البيانات والمصادقة:** Supabase (PostgreSQL + Auth) باستخدام **`@supabase/ssr`**
- **النشر:** Vercel

### الإعداد المحلي

**المتطلبات:** Node.js 18.17+ و npm.

```bash
npm install
cp .env.local.example .env.local   # ثم أدخل قيم Supabase
npm run dev                         # افتح http://localhost:3000
npm run build && npm run start      # بناء الإنتاج
```

> **ملاحظة:** إذا لم تُضبط متغيرات Supabase، يعود التطبيق تلقائياً إلى البيانات التجريبية المضمّنة (`src/lib/demo-data.ts`)، فيعمل ويُبنى دون أي إعداد.

### متغيّرات البيئة

| المتغيّر | الوصف |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام للوصول من جهة العميل |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح دور الخدمة للعمليات المميّزة من جهة الخادم |

### إعداد Supabase

1. أنشئ مشروع Supabase جديداً.
2. طبّق ملفات الترحيل بالترتيب: `00001_initial_schema.sql` ثم `00002_seed_data.sql`.
3. الملفان **قابلان لإعادة التطبيق بأمان** (idempotent).
4. انسخ الرابط والمفاتيح إلى `.env.local`.

### النشر على Vercel

ادفع المستودع إلى GitHub، واستورد المشروع في Vercel، وأضف المتغيّرات الثلاثة أعلاه، ثم انشر.

---

<div align="center">
<sub>Built for the General Authority for Competition (GAC) · بُنيت لصالح الهيئة العامة للمنافسة</sub>
</div>
