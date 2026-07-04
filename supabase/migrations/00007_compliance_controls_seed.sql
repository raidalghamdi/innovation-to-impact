-- Migration 00007 — Seed example compliance controls (3–5 per standard body)
-- Purpose: populate innovation.compliance_controls with representative controls
-- mapped to real platform feature paths. Idempotent via ON CONFLICT (control_code).
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply. Requires migration 00006 first.

begin;

insert into innovation.compliance_controls
  (standard_body, control_code, title_en, title_ar, description_en, description_ar, mapped_feature_paths, status, last_reviewed_at)
values
  -- SDAIA (AI / data)
  ('SDAIA','SDAIA-AI-01','AI ethics assessment','تقييم أخلاقيات الذكاء الاصطناعي','Documented ethics review for AI-assisted features.','مراجعة أخلاقية موثقة للميزات المدعومة بالذكاء الاصطناعي.','{"src/lib/ai/"}','in_progress','2026-05-01'),
  ('SDAIA','SDAIA-DA-02','Data anonymization','إخفاء هوية البيانات','Analytics use aggregated, non-identifying data.','استخدام بيانات مجمّعة وغير معرّفة في التحليلات.','{"src/app/[locale]/analytics/"}','met','2026-05-10'),
  ('SDAIA','SDAIA-AI-03','Human-in-the-loop decisions','قرارات بإشراف بشري','Committee decisions require human sign-off.','قرارات اللجنة تتطلب اعتماداً بشرياً.','{"src/app/[locale]/committee/actions.ts"}','met','2026-05-12'),

  -- NDMO (data management)
  ('NDMO','NDMO-DM-04','Data classification','تصنيف البيانات','Personal data classified per NDMO policy.','تصنيف البيانات الشخصية وفق سياسة مكتب إدارة البيانات.','{"supabase/migrations/"}','met','2026-04-18'),
  ('NDMO','NDMO-DG-05','Data ownership','ملكية البيانات','Each dataset has an accountable owner.','لكل مجموعة بيانات مالك مسؤول.','{"src/lib/roles.ts"}','in_progress','2026-04-20'),
  ('NDMO','NDMO-RT-06','Retention policy','سياسة الاحتفاظ','Retention periods defined for audit data.','تحديد فترات الاحتفاظ ببيانات التدقيق.','{"src/lib/audit.ts"}','not_started',null),

  -- DGA (digital government)
  ('DGA','DGA-DX-02','Bilingual digital service','خدمة رقمية ثنائية اللغة','Service available in Arabic and English with RTL.','توفر الخدمة بالعربية والإنجليزية مع دعم الاتجاه من اليمين لليسار.','{"messages/ar.json","messages/en.json"}','met','2026-04-30'),
  ('DGA','DGA-AC-03','Accessibility','إمكانية الوصول','UI meets accessibility guidance (aria-live, contrast).','تلتزم الواجهة بإرشادات إمكانية الوصول.','{"src/components/"}','in_progress','2026-05-05'),
  ('DGA','DGA-OP-04','Health probe','فحص الجاهزية','Public liveness endpoint for uptime monitoring.','نقطة فحص عامة لمراقبة التوافر.','{"src/app/api/health/route.ts"}','met','2026-05-06'),

  -- NCA (cybersecurity)
  ('NCA','NCA-ECC-1-2','Audit logging','تسجيل التدقيق','Tamper-evident audit trail for key actions.','سجل تدقيق محميّ من التلاعب للإجراءات المهمة.','{"src/lib/audit.ts","supabase/migrations/00005_audit_hash_chain.sql"}','met','2026-06-01'),
  ('NCA','NCA-ECC-2-1','Access control','التحكم بالوصول','Role-based route access enforced in middleware.','تطبيق التحكم بالوصول حسب الدور في الوسيط.','{"src/lib/roles.ts"}','met','2026-06-02'),
  ('NCA','NCA-ECC-2-8','Session management','إدارة الجلسات','Supabase-managed sessions with server verification.','جلسات مُدارة عبر Supabase مع تحقق من الخادم.','{"src/lib/supabase/server.ts"}','met','2026-06-03'),

  -- CST (communications)
  ('CST','CST-DH-03','Data hosting region','منطقة استضافة البيانات','Data hosted in an approved region.','استضافة البيانات في منطقة معتمدة.','{}','not_started',null),

  -- RDIA (research, development & innovation)
  ('RDIA','RDIA-IN-01','Innovation reporting','تقارير الابتكار','Innovation KPIs reported to RDIA.','رفع مؤشرات الابتكار إلى هيئة البحث والتطوير والابتكار.','{"src/app/[locale]/analytics/"}','not_applicable',null),
  ('RDIA','RDIA-IN-02','Idea pipeline traceability','تتبّع مسار الأفكار','Idea lifecycle transitions are auditable.','انتقالات دورة حياة الأفكار قابلة للتدقيق.','{"src/lib/lifecycle.ts"}','in_progress','2026-06-10')
on conflict (control_code) do nothing;

commit;

-- POST-VERIFY:
--   select standard_body, count(*) from innovation.compliance_controls group by 1 order by 1;
-- ROLLBACK (manual):
--   delete from innovation.compliance_controls where control_code like 'SDAIA-%' or control_code like 'NDMO-%'
--     or control_code like 'DGA-%' or control_code like 'NCA-%' or control_code like 'CST-%' or control_code like 'RDIA-%';
