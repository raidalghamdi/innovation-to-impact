-- =====================================================================
-- Innovation-to-Impact Platform — GAC
-- Migration 00002: Seed data
-- Idempotent via fixed UUIDs + ON CONFLICT DO NOTHING.
--
-- NOTE: user_profiles normally reference auth.users. For seeding demo
-- content we temporarily drop the FK so sample profiles can exist without
-- corresponding auth accounts. When real users sign up, the
-- handle_new_user() trigger populates genuine profiles.
-- =====================================================================

alter table public.user_profiles
  drop constraint if exists user_profiles_id_fkey;

-- ---------- Users (1 admin + 5 evaluators + submitters) ----------
insert into public.user_profiles (id, full_name, email, role, department, language_preference, user_category) values
  ('00000000-0000-0000-0000-000000000001','رائد الغامدي','raid.alghamdi@gac.gov.sa','admin','Strategy & Innovation','ar','employee'),
  ('00000000-0000-0000-0000-000000000002','سارة العتيبي','sara.alotaibi@gac.gov.sa','evaluator','Economic Studies','ar','employee'),
  ('00000000-0000-0000-0000-000000000003','محمد القحطاني','mohammed.alqahtani@gac.gov.sa','evaluator','Legal Affairs','ar','employee'),
  ('00000000-0000-0000-0000-000000000004','نورة الشمري','noura.alshammari@gac.gov.sa','evaluator','Market Monitoring','ar','employee'),
  ('00000000-0000-0000-0000-000000000005','عبدالله الدوسري','abdullah.aldosari@gac.gov.sa','evaluator','Digital Transformation','ar','employee'),
  ('00000000-0000-0000-0000-000000000006','هند الزهراني','hind.alzahrani@gac.gov.sa','evaluator','Mergers & Acquisitions','ar','employee'),
  ('00000000-0000-0000-0000-000000000007','فهد المطيري','fahad.almutairi@startup.sa','member','—','ar','startup'),
  ('00000000-0000-0000-0000-000000000008','Lina Park','lina.park@academic.edu','member','KAUST','en','academic')
on conflict (id) do nothing;

-- ---------- Strategic themes ----------
insert into public.strategic_themes (id, name_ar, name_en, description, priority, owner_id) values
  ('10000000-0000-0000-0000-000000000001','تعزيز المنافسة في الأسواق الرقمية','Strengthening competition in digital markets','Promote fair competition across digital platforms and e-commerce.',1,'00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002','تمكين المنشآت الصغيرة والمتوسطة','Empowering SMEs','Lower barriers to entry and protect SMEs from anti-competitive practices.',2,'00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000003','الكفاءة التنظيمية والشفافية','Regulatory efficiency & transparency','Streamline review processes and improve transparency of decisions.',2,'00000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- ---------- Activities (one hackathon, one continuous scheme) ----------
insert into public.activities (id, name_ar, name_en, type, status, start_date, end_date, target_audience, created_by) values
  ('20000000-0000-0000-0000-000000000001','هاكاثون المنافسة العادلة 2025','Fair Competition Hackathon 2025','hackathon','active','2025-03-01','2025-03-03','startups, academics','00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002','برنامج الأفكار المستمر','Continuous Ideas Scheme','idea_scheme','active','2025-01-01',null,'employees','00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------- Ideas (~15 across stages) ----------
insert into public.ideas (id, code, title_ar, title_en, problem_statement, proposed_solution, expected_benefits, category, strategic_theme_id, activity_id, status, current_stage, submitter_id, ownership_acknowledged, source, confidentiality) values
  ('30000000-0000-0000-0000-000000000001','IDEA-2025-001','منصة موحدة لرصد الأسعار','Unified price monitoring platform','Price signals are fragmented across sectors.','A central data pipeline aggregating retail prices.','Faster detection of price coordination.','market_monitoring','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','benefits_tracking',8,'00000000-0000-0000-0000-000000000002',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000002','IDEA-2025-002','مؤشر تركز السوق الآلي','Automated market concentration index','Manual HHI calculation is slow.','Automated HHI computation from filings.','Cuts analysis time by 60%.','analytics','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','in_implementation',7,'00000000-0000-0000-0000-000000000005',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000003','IDEA-2025-003','بوابة بلاغات تجار التجزئة','Retailer complaints portal','SMEs lack an easy complaint channel.','A guided bilingual complaint intake portal.','Higher SME participation.','services','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','in_pilot',6,'00000000-0000-0000-0000-000000000007',true,'new','public'),
  ('30000000-0000-0000-0000-000000000004','IDEA-2025-004','نموذج كشف التواطؤ بالذكاء الاصطناعي','AI bid-rigging detection model','Bid rigging is hard to detect manually.','ML model flagging suspicious bidding patterns.','Improved enforcement outcomes.','enforcement','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','assigned',5,'00000000-0000-0000-0000-000000000008',true,'new','confidential'),
  ('30000000-0000-0000-0000-000000000005','IDEA-2025-005','تبسيط إجراءات الاندماج','Simplified merger filing','Merger filings are paperwork-heavy.','A digital wizard for merger notifications.','Shorter review cycle.','process','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','committee',4,'00000000-0000-0000-0000-000000000006',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000006','IDEA-2025-006','لوحة شفافية القرارات','Decisions transparency dashboard','Public has limited visibility of rulings.','A public dashboard of anonymized decisions.','Higher public trust.','transparency','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','evaluation',4,'00000000-0000-0000-0000-000000000002',true,'new','public'),
  ('30000000-0000-0000-0000-000000000007','IDEA-2025-007','برنامج توعية المنشآت الناشئة','Startup awareness program','Startups unaware of competition rules.','Workshops and a self-assessment toolkit.','Reduced inadvertent violations.','education','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','evaluation',4,'00000000-0000-0000-0000-000000000007',true,'new','public'),
  ('30000000-0000-0000-0000-000000000008','IDEA-2025-008','واجهة برمجية للبيانات المفتوحة','Open data API','Researchers can not access aggregate data.','A documented open-data API.','Enables external research.','data','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','screening',3,'00000000-0000-0000-0000-000000000008',true,'new','public'),
  ('30000000-0000-0000-0000-000000000009','IDEA-2025-009','تحليل شكاوى المستهلكين','Consumer complaint analytics','Complaints are not analyzed at scale.','NLP clustering of complaints.','Pattern detection for sectors.','analytics','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','screening',3,'00000000-0000-0000-0000-000000000004',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000010','IDEA-2025-010','مساعد افتراضي للأنظمة','Regulations virtual assistant','Staff search regulations manually.','A retrieval assistant over the legal corpus.','Faster legal lookups.','knowledge','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','submitted',1,'00000000-0000-0000-0000-000000000003',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000011','IDEA-2025-011','مؤشر صحة المنافسة القطاعي','Sector competition health index','No single sector health metric.','Composite index per sector.','Prioritizes interventions.','analytics','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','submitted',1,'00000000-0000-0000-0000-000000000005',true,'new','internal'),
  ('30000000-0000-0000-0000-000000000012','IDEA-2025-012','نظام تتبع الالتزام','Compliance tracking system','Hard to track remedy commitments.','A commitments register with reminders.','Better remedy enforcement.','process','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','draft',0,'00000000-0000-0000-0000-000000000006',false,'new','internal'),
  ('30000000-0000-0000-0000-000000000013','IDEA-2025-013','حملة توعية المستهلك','Consumer awareness campaign','Consumers unaware of their rights.','A multi-channel awareness campaign.','Empowered consumers.','education','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','approved',5,'00000000-0000-0000-0000-000000000007',true,'new','public'),
  ('30000000-0000-0000-0000-000000000014','IDEA-2025-014','أرشفة القضايا التاريخية','Legacy case archiving','Old cases are on paper.','Digitize and index legacy cases.','Searchable case history.','data','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','closed',8,'00000000-0000-0000-0000-000000000002',true,'legacy_migration','internal'),
  ('30000000-0000-0000-0000-000000000015','IDEA-2025-015','مختبر تنظيمي للأسواق الرقمية','Digital markets regulatory lab','Need safe testing of new rules.','A sandbox to pilot regulatory measures.','Evidence-based rulemaking.','policy','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','returned',4,'00000000-0000-0000-0000-000000000008',true,'new','internal')
on conflict (id) do nothing;

-- ---------- Idea relationships ----------
insert into public.idea_relationships (id, idea_id, related_idea_id, relationship_type, confidence_score, detected_by) values
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000001','related',0.820,'ai'),
  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000002','cross_theme',0.710,'ai'),
  ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000008','related',0.640,'human')
on conflict (id) do nothing;

-- ---------- Evaluations ----------
insert into public.evaluations (id, idea_id, evaluator_id, criteria_scores, total_score, comments, recommendation, conflict_of_interest) values
  ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003','{"impact":8,"feasibility":7,"strategic_fit":9,"cost":6}',77.5,'Strong transparency value.','advance','false'),
  ('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000004','{"impact":7,"feasibility":8,"strategic_fit":7,"cost":8}',75.0,'Good reach for SMEs.','advance','false'),
  ('50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','{"impact":6,"feasibility":9,"strategic_fit":8,"cost":7}',74.0,'Quick win on cycle time.','advance','false')
on conflict (id) do nothing;

-- ---------- Committee decisions ----------
insert into public.committee_decisions (id, idea_id, committee_name, decision, quorum_met, comments, decided_by) values
  ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000013','Innovation Committee','approve','true','Approved for delivery.','00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005','Innovation Committee','study','true','Needs legal review of digital signatures.','00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000015','Innovation Committee','return','false','Quorum not met; resubmit with scope.','00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------- Assignments ----------
insert into public.assignments (id, idea_id, owner_id, department, due_date, status) values
  ('70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Digital Transformation','2025-06-30','in_progress'),
  ('70000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000004','Market Monitoring','2025-05-15','open')
on conflict (id) do nothing;

-- ---------- Pilots ----------
insert into public.pilots (id, idea_id, hypothesis, experiment_plan, budget, start_date, end_date, milestones, results, lessons_learned, status) values
  ('80000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','A guided portal increases SME complaints by 30%.','Run portal with 3 sectors for 8 weeks.',150000,'2025-04-01','2025-05-26','[{"name":"Launch","done":true},{"name":"Mid-review","done":true},{"name":"Final","done":false}]','Complaints up 24% at mid-review.','UX simplification needed for Arabic forms.','running'),
  ('80000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','A unified feed cuts detection lag in half.','Pilot across grocery retail.',220000,'2025-01-10','2025-03-10','[{"name":"Data onboarding","done":true},{"name":"Model tuning","done":true}]','Detection lag reduced 52%.','Data quality is the main constraint.','completed')
on conflict (id) do nothing;

-- ---------- Scale decisions ----------
insert into public.scale_decisions (id, idea_id, evidence_of_viability, value_assessment, risk_assessment, strategic_fit_score, decision, decided_by) values
  ('90000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Pilot exceeded target.','High recurring analytical value.','Data governance risk — mitigated.',9.0,'scale','00000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Implementation underway.','Time savings validated.','Low.',8.5,'scale','00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------- Implementations ----------
insert into public.implementations (id, idea_id, operational_owner, integration_plan, resource_commitment, handover_status, line_unit) values
  ('a0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Digital Transformation Dept','Integrate into BI stack over 2 sprints.','2 engineers, 1 analyst','in_progress','Analytics Unit'),
  ('a0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Market Monitoring Dept','Operationalize daily feed.','1 data engineer','completed','Monitoring Unit')
on conflict (id) do nothing;

-- ---------- Benefits ----------
insert into public.benefits (id, idea_id, benefit_type, category, target_value, realized_value, measurement_unit, measurement_date, verified_by) values
  ('b0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','financial','savings',800000,920000,'SAR','2025-06-01','00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','non_financial','service_improvement',50,52,'% faster detection','2025-06-01','00000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','financial','savings',400000,310000,'SAR','2025-05-20','00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000014','non_financial','capability',1,1,'archive digitized','2025-02-01','00000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- ---------- Funding requests ----------
insert into public.funding_requests (id, idea_id, amount_sar, justification, status, approved_amount, approver_id, decided_at) values
  ('c0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003',150000,'Pilot delivery costs.','disbursed',150000,'00000000-0000-0000-0000-000000000001',now()),
  ('c0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004',300000,'ML infrastructure and labeling.','approved',250000,'00000000-0000-0000-0000-000000000001',now()),
  ('c0000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000013',90000,'Campaign media buy.','requested',null,null,null)
on conflict (id) do nothing;

-- ---------- IP records ----------
insert into public.ip_records (id, idea_id, ip_type, ownership_party, confidentiality_terms, nda_required, participation_conditions) values
  ('d0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','trade_secret','GAC','Model details confidential.',true,'Contractors must sign NDA before access.'),
  ('d0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000008','copyright','GAC','Open data under CC-BY.',false,'Attribution required.')
on conflict (id) do nothing;

-- ---------- Knowledge articles ----------
insert into public.knowledge_articles (id, idea_id, title_ar, title_en, type, content_md, tags, author_id) values
  ('e0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','دروس من منصة رصد الأسعار','Lessons from the price monitoring pilot','lesson_learned','# Lessons\n- Data quality matters most.\n- Start with one sector.',array['pilot','data','monitoring'],'00000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','دليل تشغيل بوابة البلاغات','Complaints portal playbook','playbook','# Playbook\nStep-by-step onboarding for new sectors.',array['playbook','sme','portal'],'00000000-0000-0000-0000-000000000007')
on conflict (id) do nothing;

-- ---------- Compliance controls (SDAIA/NDMO, NCA, DGA, CST, RDIA) ----------
insert into public.compliance_controls (id, regulator, clause, applicability, owner_id, evidence_required, mapped_feature, review_cycle, status, last_review_date) values
  -- SDAIA / NDMO (National Data Management & Personal Data Protection Standards)
  ('f0000000-0000-0000-0000-000000000001','SDAIA_NDMO','Domain 1 — Data Governance: establish data governance roles and policies','All platform data','00000000-0000-0000-0000-000000000005','Data governance charter, RACI','Admin / audit log','Annual','compliant','2025-01-15'),
  ('f0000000-0000-0000-0000-000000000002','SDAIA_NDMO','Domain 13 — Data Classification: classify data by sensitivity','Ideas & attachments','00000000-0000-0000-0000-000000000005','Classification matrix','Confidentiality selector','Annual','compliant','2025-01-15'),
  ('f0000000-0000-0000-0000-000000000003','SDAIA_NDMO','Domain 14 — Personal Data Protection: lawful processing & consent','User profiles','00000000-0000-0000-0000-000000000003','Consent records, privacy notice','IP consent & profiles','Semi-annual','in_progress','2025-03-01'),
  ('f0000000-0000-0000-0000-000000000004','SDAIA_NDMO','Domain 15 — Data Security & Protection: encryption at rest and in transit','Database','00000000-0000-0000-0000-000000000005','Encryption config, RLS policies','Supabase RLS','Annual','compliant','2025-02-01'),
  -- NCA (Essential Cybersecurity Controls — ECC)
  ('f0000000-0000-0000-0000-000000000005','NCA','ECC 1 — Cybersecurity Governance: policies, roles and responsibilities','Whole platform','00000000-0000-0000-0000-000000000001','Cybersecurity policy','Roles & permissions','Annual','compliant','2025-01-20'),
  ('f0000000-0000-0000-0000-000000000006','NCA','ECC 2 — Identity & Access Management','Authentication','00000000-0000-0000-0000-000000000005','IAM design, MFA evidence','Supabase Auth','Annual','in_progress','2025-03-10'),
  ('f0000000-0000-0000-0000-000000000007','NCA','ECC 2 — Cryptography: protect data confidentiality','Data layer','00000000-0000-0000-0000-000000000005','TLS / encryption report','HTTPS + DB encryption','Annual','compliant','2025-02-05'),
  ('f0000000-0000-0000-0000-000000000008','NCA','ECC 4 — Third-Party & Cloud Security','Hosting','00000000-0000-0000-0000-000000000005','Vendor assessment (Vercel, Supabase)','Cloud hosting','Annual','in_progress','2025-03-12'),
  -- DGA (Digital Government Authority — e-government standards)
  ('f0000000-0000-0000-0000-000000000009','DGA','Digital Services Lifecycle: beneficiary-centric service design','Public-facing pages','00000000-0000-0000-0000-000000000004','UX research, accessibility audit','Bilingual UI / RTL','Annual','compliant','2025-02-10'),
  ('f0000000-0000-0000-0000-000000000010','DGA','National Design System & accessibility (WCAG)','Frontend','00000000-0000-0000-0000-000000000004','Accessibility report','UI components','Annual','in_progress','2025-03-15'),
  ('f0000000-0000-0000-0000-000000000011','DGA','Whole-of-government interoperability & open data','APIs','00000000-0000-0000-0000-000000000005','API documentation','Open data API','Annual','non_compliant','2025-03-01'),
  -- CST (Communications, Space & Technology Commission)
  ('f0000000-0000-0000-0000-000000000012','CST','Cloud Computing Regulatory Framework: data residency','Hosting region','00000000-0000-0000-0000-000000000005','Data residency attestation','Hosting configuration','Annual','in_progress','2025-03-08'),
  ('f0000000-0000-0000-0000-000000000013','CST','Personal data hosting classification compliance','Database region','00000000-0000-0000-0000-000000000003','Hosting classification','Database region','Annual','in_progress','2025-03-08'),
  -- RDIA (Research, Development & Innovation Authority)
  ('f0000000-0000-0000-0000-000000000014','RDIA','RDI priorities alignment: innovation aligned to national RDI priorities','Strategy module','00000000-0000-0000-0000-000000000001','Strategic mapping','Strategic themes','Annual','compliant','2025-01-25'),
  ('f0000000-0000-0000-0000-000000000015','RDIA','IP & knowledge management for funded innovation','IP & knowledge modules','00000000-0000-0000-0000-000000000003','IP register, knowledge base','IP & Knowledge','Annual','compliant','2025-02-20')
on conflict (id) do nothing;

-- ---------- Notifications ----------
insert into public.notifications (id, user_id, type, title_ar, title_en, body_ar, body_en, link) values
  ('aa000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','evaluation','مهمة تقييم جديدة','New evaluation task','تم إسناد فكرة جديدة لتقييمك.','A new idea has been assigned for your evaluation.','/ar/evaluation'),
  ('aa000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000007','decision','تم اعتماد فكرتك','Your idea was approved','تهانينا، تم اعتماد فكرتك.','Congratulations, your idea was approved.','/ar/ideas')
on conflict (id) do nothing;
