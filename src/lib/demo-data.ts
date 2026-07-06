// Demo/seed dataset mirroring supabase/migrations/00002_seed_data.sql.
// Used as a fallback when Supabase is not configured so the app renders
// realistic content during build and preview.

import { pick } from '@/lib/i18n-content';

export type Idea = {
  id: string;
  code: string;
  title_ar: string;
  title_en: string;
  problem_statement: string;
  proposed_solution: string;
  expected_benefits: string;
  category: string;
  strategic_theme_id: string;
  activity_id: string;
  status: string;
  current_stage: number;
  submitter_id: string;
  confidentiality: string;
  source: string;
  created_at: string;
  updated_at?: string | null;
};

export type StrategicTheme = {
  id: string;
  name_ar: string;
  name_en: string;
  description: string;
  priority: number;
  owner_id: string;
};

export type Activity = {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  target_audience: string;
};

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  user_category: string;
};

export type ComplianceControl = {
  id: string;
  regulator: string;
  clause: string;
  applicability: string;
  evidence_required: string;
  mapped_feature: string;
  review_cycle: string;
  status: string;
  last_review_date: string;
};

export type Benefit = {
  id: string;
  idea_id: string;
  benefit_type: string;
  category: string;
  target_value: number;
  realized_value: number;
  measurement_unit: string;
  measurement_date: string;
};

export type KnowledgeArticle = {
  id: string;
  title_ar: string;
  title_en: string;
  type: string;
  tags: string[];
  published_at: string;
  source_url?: string;
  source_label_ar?: string;
  source_label_en?: string;
};

export const users: UserProfile[] = [
  { id: 'u1', full_name: 'رائد الغامدي', email: 'raid.alghamdi@gac.gov.sa', role: 'admin', department: 'Strategy & Innovation', user_category: 'employee' },
  { id: 'u2', full_name: 'سارة العتيبي', email: 'sara.alotaibi@gac.gov.sa', role: 'evaluator', department: 'Economic Studies', user_category: 'employee' },
  { id: 'u3', full_name: 'محمد القحطاني', email: 'mohammed.alqahtani@gac.gov.sa', role: 'evaluator', department: 'Legal Affairs', user_category: 'employee' },
  { id: 'u4', full_name: 'نورة الشمري', email: 'noura.alshammari@gac.gov.sa', role: 'evaluator', department: 'Market Monitoring', user_category: 'employee' },
  { id: 'u5', full_name: 'عبدالله الدوسري', email: 'abdullah.aldosari@gac.gov.sa', role: 'evaluator', department: 'Digital Transformation', user_category: 'employee' },
  { id: 'u6', full_name: 'هند الزهراني', email: 'hind.alzahrani@gac.gov.sa', role: 'evaluator', department: 'Mergers & Acquisitions', user_category: 'employee' },
  { id: 'u7', full_name: 'فهد المطيري', email: 'fahad.almutairi@startup.sa', role: 'member', department: '—', user_category: 'startup' },
  { id: 'u-innovator', full_name: 'مشارك تجريبي', email: 'innovator@gac-demo.sa', role: 'innovator', department: '—', user_category: 'employee' },
  { id: 'u8', full_name: 'Lina Park', email: 'lina.park@academic.edu', role: 'member', department: 'KAUST', user_category: 'academic' },
];

export const themes: StrategicTheme[] = [
  { id: 't1', name_ar: 'تعزيز المنافسة في الأسواق الرقمية', name_en: 'Strengthening competition in digital markets', description: 'Promote fair competition across digital platforms and e-commerce.', priority: 1, owner_id: 'u1' },
  { id: 't2', name_ar: 'تمكين المنشآت الصغيرة والمتوسطة', name_en: 'Empowering SMEs', description: 'Lower barriers to entry and protect SMEs from anti-competitive practices.', priority: 2, owner_id: 'u4' },
  { id: 't3', name_ar: 'الكفاءة التنظيمية والشفافية', name_en: 'Regulatory efficiency & transparency', description: 'Streamline review processes and improve transparency of decisions.', priority: 2, owner_id: 'u3' },
];

export const activities: Activity[] = [
  { id: 'a1', name_ar: 'فعالية المنافسة العادلة 2025', name_en: 'Fair Competition Event 2025', type: 'hackathon', status: 'active', start_date: '2025-03-01', end_date: '2025-03-03', target_audience: 'startups, academics' },
  { id: 'a2', name_ar: 'برنامج الأفكار المستمر', name_en: 'Continuous Ideas Scheme', type: 'idea_scheme', status: 'active', start_date: '2025-01-01', end_date: null, target_audience: 'employees' },
];

export const ideas: Idea[] = [
  { id: 'i1', code: 'IDEA-2025-001', title_ar: 'منصة موحدة لرصد الأسعار', title_en: 'Unified price monitoring platform', problem_statement: 'Price signals are fragmented across sectors.', proposed_solution: 'A central data pipeline aggregating retail prices.', expected_benefits: 'Faster detection of price coordination.', category: 'market_monitoring', strategic_theme_id: 't1', activity_id: 'a2', status: 'benefits_tracking', current_stage: 8, submitter_id: 'u2', confidentiality: 'internal', source: 'new', created_at: '2025-01-12' },
  { id: 'i2', code: 'IDEA-2025-002', title_ar: 'مؤشر تركز السوق الآلي', title_en: 'Automated market concentration index', problem_statement: 'Manual HHI calculation is slow.', proposed_solution: 'Automated HHI computation from filings.', expected_benefits: 'Cuts analysis time by 60%.', category: 'analytics', strategic_theme_id: 't3', activity_id: 'a2', status: 'in_implementation', current_stage: 7, submitter_id: 'u5', confidentiality: 'internal', source: 'new', created_at: '2025-01-18' },
  { id: 'i3', code: 'IDEA-2025-003', title_ar: 'بوابة بلاغات تجار التجزئة', title_en: 'Retailer complaints portal', problem_statement: 'SMEs lack an easy complaint channel.', proposed_solution: 'A guided bilingual complaint intake portal.', expected_benefits: 'Higher SME participation.', category: 'services', strategic_theme_id: 't2', activity_id: 'a1', status: 'in_pilot', current_stage: 6, submitter_id: 'u7', confidentiality: 'public', source: 'new', created_at: '2025-02-02' },
  { id: 'i4', code: 'IDEA-2025-004', title_ar: 'نموذج كشف التواطؤ بالذكاء الاصطناعي', title_en: 'AI bid-rigging detection model', problem_statement: 'Bid rigging is hard to detect manually.', proposed_solution: 'ML model flagging suspicious bidding patterns.', expected_benefits: 'Improved enforcement outcomes.', category: 'enforcement', strategic_theme_id: 't1', activity_id: 'a1', status: 'assigned', current_stage: 5, submitter_id: 'u8', confidentiality: 'confidential', source: 'new', created_at: '2025-02-08' },
  { id: 'i5', code: 'IDEA-2025-005', title_ar: 'تبسيط إجراءات الاندماج', title_en: 'Simplified merger filing', problem_statement: 'Merger filings are paperwork-heavy.', proposed_solution: 'A digital wizard for merger notifications.', expected_benefits: 'Shorter review cycle.', category: 'process', strategic_theme_id: 't3', activity_id: 'a2', status: 'committee', current_stage: 4, submitter_id: 'u6', confidentiality: 'internal', source: 'new', created_at: '2025-02-11' },
  { id: 'i6', code: 'IDEA-2025-006', title_ar: 'لوحة شفافية القرارات', title_en: 'Decisions transparency dashboard', problem_statement: 'Public has limited visibility of rulings.', proposed_solution: 'A public dashboard of anonymized decisions.', expected_benefits: 'Higher public trust.', category: 'transparency', strategic_theme_id: 't3', activity_id: 'a2', status: 'evaluation', current_stage: 4, submitter_id: 'u2', confidentiality: 'public', source: 'new', created_at: '2025-02-14' },
  { id: 'i7', code: 'IDEA-2025-007', title_ar: 'برنامج توعية المنشآت الناشئة', title_en: 'Startup awareness program', problem_statement: 'Startups unaware of competition rules.', proposed_solution: 'Workshops and a self-assessment toolkit.', expected_benefits: 'Reduced inadvertent violations.', category: 'education', strategic_theme_id: 't2', activity_id: 'a1', status: 'evaluation', current_stage: 4, submitter_id: 'u7', confidentiality: 'public', source: 'new', created_at: '2025-02-17' },
  { id: 'i8', code: 'IDEA-2025-008', title_ar: 'واجهة برمجية للبيانات المفتوحة', title_en: 'Open data API', problem_statement: 'Researchers can not access aggregate data.', proposed_solution: 'A documented open-data API.', expected_benefits: 'Enables external research.', category: 'data', strategic_theme_id: 't1', activity_id: 'a1', status: 'screening', current_stage: 3, submitter_id: 'u8', confidentiality: 'public', source: 'new', created_at: '2025-02-20' },
  { id: 'i9', code: 'IDEA-2025-009', title_ar: 'تحليل شكاوى المستهلكين', title_en: 'Consumer complaint analytics', problem_statement: 'Complaints are not analyzed at scale.', proposed_solution: 'NLP clustering of complaints.', expected_benefits: 'Pattern detection for sectors.', category: 'analytics', strategic_theme_id: 't1', activity_id: 'a2', status: 'screening', current_stage: 3, submitter_id: 'u4', confidentiality: 'internal', source: 'new', created_at: '2025-02-22' },
  { id: 'i10', code: 'IDEA-2025-010', title_ar: 'مساعد افتراضي للأنظمة', title_en: 'Regulations virtual assistant', problem_statement: 'Staff search regulations manually.', proposed_solution: 'A retrieval assistant over the legal corpus.', expected_benefits: 'Faster legal lookups.', category: 'knowledge', strategic_theme_id: 't3', activity_id: 'a2', status: 'submitted', current_stage: 1, submitter_id: 'u3', confidentiality: 'internal', source: 'new', created_at: '2025-02-25' },
  { id: 'i11', code: 'IDEA-2025-011', title_ar: 'مؤشر صحة المنافسة القطاعي', title_en: 'Sector competition health index', problem_statement: 'No single sector health metric.', proposed_solution: 'Composite index per sector.', expected_benefits: 'Prioritizes interventions.', category: 'analytics', strategic_theme_id: 't1', activity_id: 'a2', status: 'submitted', current_stage: 1, submitter_id: 'u5', confidentiality: 'internal', source: 'new', created_at: '2025-02-27' },
  { id: 'i12', code: 'IDEA-2025-012', title_ar: 'نظام تتبع الالتزام', title_en: 'Compliance tracking system', problem_statement: 'Hard to track remedy commitments.', proposed_solution: 'A commitments register with reminders.', expected_benefits: 'Better remedy enforcement.', category: 'process', strategic_theme_id: 't3', activity_id: 'a2', status: 'draft', current_stage: 0, submitter_id: 'u6', confidentiality: 'internal', source: 'new', created_at: '2025-03-01' },
  { id: 'i13', code: 'IDEA-2025-013', title_ar: 'حملة توعية المستهلك', title_en: 'Consumer awareness campaign', problem_statement: 'Consumers unaware of their rights.', proposed_solution: 'A multi-channel awareness campaign.', expected_benefits: 'Empowered consumers.', category: 'education', strategic_theme_id: 't2', activity_id: 'a1', status: 'approved', current_stage: 5, submitter_id: 'u7', confidentiality: 'public', source: 'new', created_at: '2025-03-03' },
  { id: 'i14', code: 'IDEA-2025-014', title_ar: 'أرشفة القضايا التاريخية', title_en: 'Legacy case archiving', problem_statement: 'Old cases are on paper.', proposed_solution: 'Digitize and index legacy cases.', expected_benefits: 'Searchable case history.', category: 'data', strategic_theme_id: 't3', activity_id: 'a2', status: 'closed', current_stage: 8, submitter_id: 'u2', confidentiality: 'internal', source: 'legacy_migration', created_at: '2024-11-05' },
  { id: 'i15', code: 'IDEA-2025-015', title_ar: 'مختبر تنظيمي للأسواق الرقمية', title_en: 'Digital markets regulatory lab', problem_statement: 'Need safe testing of new rules.', proposed_solution: 'A sandbox to pilot regulatory measures.', expected_benefits: 'Evidence-based rulemaking.', category: 'policy', strategic_theme_id: 't1', activity_id: 'a1', status: 'returned', current_stage: 4, submitter_id: 'u8', confidentiality: 'internal', source: 'new', created_at: '2025-03-04' },
];

export const benefits: Benefit[] = [
  { id: 'b1', idea_id: 'i1', benefit_type: 'financial', category: 'savings', target_value: 800000, realized_value: 920000, measurement_unit: 'SAR', measurement_date: '2025-06-01' },
  { id: 'b2', idea_id: 'i1', benefit_type: 'non_financial', category: 'service_improvement', target_value: 50, realized_value: 52, measurement_unit: '% faster detection', measurement_date: '2025-06-01' },
  { id: 'b3', idea_id: 'i2', benefit_type: 'financial', category: 'savings', target_value: 400000, realized_value: 310000, measurement_unit: 'SAR', measurement_date: '2025-05-20' },
  { id: 'b4', idea_id: 'i14', benefit_type: 'non_financial', category: 'capability', target_value: 1, realized_value: 1, measurement_unit: 'archive digitized', measurement_date: '2025-02-01' },
];

export const knowledge: KnowledgeArticle[] = [
  // Internal platform knowledge
  { id: 'k1', title_ar: 'دروس من منصة رصد الأسعار', title_en: 'Lessons from the price monitoring pilot', type: 'lesson_learned', tags: ['pilot', 'data', 'monitoring'], published_at: '2025-06-05' },
  { id: 'k2', title_ar: 'دليل تشغيل بوابة البلاغات', title_en: 'Complaints portal playbook', type: 'playbook', tags: ['playbook', 'sme', 'portal'], published_at: '2025-05-10' },

  // Official GAC guides (source: https://gac.gov.sa)
  { id: 'k3', title_ar: 'الدليل الإرشادي لفحص التركز الاقتصادي', title_en: 'Guidelines on the review of economic concentrations', type: 'official_guide', tags: ['gac', 'mergers', 'concentration'], published_at: '2025-04-01', source_label_ar: 'إصدار 5 — أبريل 2025', source_label_en: 'Edition 5 — April 2025', source_url: 'https://gacbep.gac.gov.sa/cms/912a9673-01a9-4737-a480-f8f65783205f.pdf' },
  { id: 'k4', title_ar: 'الدليل الإرشادي للتعامل مع الاتفاقيات الرأسية والأفقية', title_en: 'Guidelines on horizontal and vertical agreements', type: 'official_guide', tags: ['gac', 'agreements', 'antitrust'], published_at: '2025-07-01', source_label_ar: 'يوليو 2025', source_label_en: 'July 2025', source_url: 'https://gacbep.gac.gov.sa/cms/9e6286ba-8c8c-4713-ba2d-3f48cdaa368c.pdf' },
  { id: 'k5', title_ar: 'دليل تعزيز المنافسة في قطاع منصّات توصيل الطعام', title_en: 'Guideline for promoting competition in food-delivery platforms', type: 'official_guide', tags: ['gac', 'digital-platforms', 'delivery'], published_at: '2026-02-01', source_label_ar: 'فبراير 2026', source_label_en: 'February 2026', source_url: 'https://istitlaa.ncc.gov.sa/ar/Trade/gac/guidelinecompetitioninfooddeliveryplatform/Pages/default.aspx' },
  { id: 'k6', title_ar: 'دليل الامتثال لنظام المنافسة ولائحته التنفيذية', title_en: 'Compliance guide for the Competition Law and its bylaws', type: 'official_guide', tags: ['gac', 'compliance', 'law'], published_at: '2021-12-01', source_label_ar: 'ديسمبر 2021', source_label_en: 'December 2021', source_url: 'https://beta.gac.gov.sa/APIGateway/api/Attachment/ShowAttachment/c60fbcce-1fc4-411f-84ec-e6aee182b6e4' },
  { id: 'k7', title_ar: 'الإرشادات العامة لمكافحة التواطؤ بين مقدّمي العروض في المنافسات العامة', title_en: 'Guidelines on combating bid-rigging in public tenders', type: 'official_guide', tags: ['gac', 'enforcement', 'bid-rigging'], published_at: '2022-01-01', source_label_ar: '2021–2022', source_label_en: '2021–2022', source_url: 'https://beta.gac.gov.sa/APIGateway/api/Attachment/ShowAttachment/ed31a355-4716-44dd-a98b-301637263aa3' },
  { id: 'k8', title_ar: 'المعجم العربي للمنافسة', title_en: 'Arabic competition glossary', type: 'official_guide', tags: ['gac', 'reference', 'glossary'], published_at: '2022-01-01', source_label_ar: '2022', source_label_en: '2022', source_url: 'https://acnbe.gac.gov.sa/Assets/pdfUploads/638658814392983212_%D8%A7%D9%84%D9%85%D8%B9%D8%AC%D9%85%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%20%D9%84%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20-%20%D8%A7%D9%84%D9%87%D9%8A%D8%A6%D8%A9%20%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9%20%D9%84%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20%D8%A8%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9.pdf' },
  { id: 'k9', title_ar: 'سياسة الخصوصية — الإصدار الأول', title_en: 'Privacy policy — version 1', type: 'official_guide', tags: ['gac', 'privacy', 'policy'], published_at: '2024-10-15', source_label_ar: 'أكتوبر 2024', source_label_en: 'October 2024', source_url: 'https://gacbep.gac.gov.sa/cms/V1_%D8%A7%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AE%D8%B5%D9%88%D8%B5%D9%8A%D8%A9_15-10-2024_.pdf' },
  { id: 'k10', title_ar: 'التقرير السنوي لشبكة المنافسة العربية', title_en: 'Arab Competition Network — annual report', type: 'official_guide', tags: ['gac', 'arab-network', 'annual-report'], published_at: '2024-01-01', source_label_ar: '2023–2024', source_label_en: '2023–2024', source_url: 'https://acnbe.gac.gov.sa/Assets/pdfUploads/638658818107911912_%D8%A7%D9%84%D8%AA%D9%82%D8%B1%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B3%D9%86%D9%88%D9%8A%20%D9%84%D8%B4%D8%A8%D9%83%D8%A9%20%D8%A7%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%202023-2024.pdf' },
];

export const compliance: ComplianceControl[] = [
  { id: 'c1', regulator: 'SDAIA_NDMO', clause: 'Domain 1 — Data Governance: establish data governance roles and policies', applicability: 'All platform data', evidence_required: 'Data governance charter, RACI', mapped_feature: 'Admin / audit log', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-01-15' },
  { id: 'c2', regulator: 'SDAIA_NDMO', clause: 'Domain 13 — Data Classification: classify data by sensitivity', applicability: 'Ideas & attachments', evidence_required: 'Classification matrix', mapped_feature: 'Confidentiality selector', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-01-15' },
  { id: 'c3', regulator: 'SDAIA_NDMO', clause: 'Domain 14 — Personal Data Protection: lawful processing & consent', applicability: 'User profiles', evidence_required: 'Consent records, privacy notice', mapped_feature: 'IP consent & profiles', review_cycle: 'Semi-annual', status: 'in_progress', last_review_date: '2025-03-01' },
  { id: 'c4', regulator: 'SDAIA_NDMO', clause: 'Domain 15 — Data Security & Protection: encryption at rest and in transit', applicability: 'Database', evidence_required: 'Encryption config, RLS policies', mapped_feature: 'Supabase RLS', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-02-01' },
  { id: 'c5', regulator: 'NCA', clause: 'ECC 1 — Cybersecurity Governance: policies, roles and responsibilities', applicability: 'Whole platform', evidence_required: 'Cybersecurity policy', mapped_feature: 'Roles & permissions', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-01-20' },
  { id: 'c6', regulator: 'NCA', clause: 'ECC 2 — Identity & Access Management', applicability: 'Authentication', evidence_required: 'IAM design, MFA evidence', mapped_feature: 'Supabase Auth', review_cycle: 'Annual', status: 'in_progress', last_review_date: '2025-03-10' },
  { id: 'c7', regulator: 'NCA', clause: 'ECC 2 — Cryptography: protect data confidentiality', applicability: 'Data layer', evidence_required: 'TLS / encryption report', mapped_feature: 'HTTPS + DB encryption', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-02-05' },
  { id: 'c8', regulator: 'NCA', clause: 'ECC 4 — Third-Party & Cloud Security', applicability: 'Hosting', evidence_required: 'Vendor assessment (Vercel, Supabase)', mapped_feature: 'Cloud hosting', review_cycle: 'Annual', status: 'in_progress', last_review_date: '2025-03-12' },
  { id: 'c9', regulator: 'DGA', clause: 'Digital Services Lifecycle: beneficiary-centric service design', applicability: 'Public-facing pages', evidence_required: 'UX research, accessibility audit', mapped_feature: 'Bilingual UI / RTL', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-02-10' },
  { id: 'c10', regulator: 'DGA', clause: 'National Design System & accessibility (WCAG)', applicability: 'Frontend', evidence_required: 'Accessibility report', mapped_feature: 'UI components', review_cycle: 'Annual', status: 'in_progress', last_review_date: '2025-03-15' },
  { id: 'c11', regulator: 'DGA', clause: 'Whole-of-government interoperability & open data', applicability: 'APIs', evidence_required: 'API documentation', mapped_feature: 'Open data API', review_cycle: 'Annual', status: 'non_compliant', last_review_date: '2025-03-01' },
  { id: 'c12', regulator: 'CST', clause: 'Cloud Computing Regulatory Framework: data residency', applicability: 'Hosting region', evidence_required: 'Data residency attestation', mapped_feature: 'Hosting configuration', review_cycle: 'Annual', status: 'in_progress', last_review_date: '2025-03-08' },
  { id: 'c13', regulator: 'CST', clause: 'Personal data hosting classification compliance', applicability: 'Database region', evidence_required: 'Hosting classification', mapped_feature: 'Database region', review_cycle: 'Annual', status: 'in_progress', last_review_date: '2025-03-08' },
  { id: 'c14', regulator: 'RDIA', clause: 'RDI priorities alignment: innovation aligned to national RDI priorities', applicability: 'Strategy module', evidence_required: 'Strategic mapping', mapped_feature: 'Strategic themes', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-01-25' },
  { id: 'c15', regulator: 'RDIA', clause: 'IP & knowledge management for funded innovation', applicability: 'IP & knowledge modules', evidence_required: 'IP register, knowledge base', mapped_feature: 'IP & Knowledge', review_cycle: 'Annual', status: 'compliant', last_review_date: '2025-02-20' },
];

// ---- Derived helpers ----
export function userName(id: string) {
  return users.find((u) => u.id === id)?.full_name ?? '—';
}
export function themeName(id: string, locale: string) {
  const t = themes.find((x) => x.id === id);
  if (!t) return '—';
  return pick(t.name_ar, t.name_en, locale);
}
export function activityName(id: string, locale: string) {
  const a = activities.find((x) => x.id === id);
  if (!a) return '—';
  return pick(a.name_ar, a.name_en, locale);
}

export const PIPELINE_STATUSES = [
  'submitted', 'screening', 'needs_completion', 'evaluation',
  'committee', 'assigned', 'in_pilot', 'in_implementation',
];

export function getStats() {
  const total = ideas.length;
  const inPipeline = ideas.filter((i) => PIPELINE_STATUSES.includes(i.status)).length;
  const inPilot = ideas.filter((i) => i.status === 'in_pilot').length;
  const realizedBenefits = benefits
    .filter((b) => b.benefit_type === 'financial')
    .reduce((s, b) => s + (b.realized_value || 0), 0);
  const participationRate = 68; // % of target audience engaged (demo metric)
  return { total, inPipeline, inPilot, realizedBenefits, participationRate };
}
