-- 00003_gac_official_guides.sql
-- Adds "official_guide" knowledge type + URL columns, and seeds the 8 official
-- guides published by the General Authority for Competition (GAC).

-- 1. Extend the knowledge_type enum
do $$ begin
  alter type knowledge_type add value if not exists 'official_guide';
exception when duplicate_object then null;
end $$;

-- 2. Add URL + date-label columns to knowledge_articles
alter table public.knowledge_articles
  add column if not exists source_url text,
  add column if not exists source_label_ar text,
  add column if not exists source_label_en text;

-- 3. Seed the 8 official GAC guides
insert into public.knowledge_articles
  (id, title_ar, title_en, type, content_md, tags, source_url, source_label_ar, source_label_en, published_at)
values
  ('e0000000-0000-0000-0000-000000000003',
   'الدليل الإرشادي لفحص التركز الاقتصادي',
   'Guidelines on the review of economic concentrations',
   'official_guide',
   null,
   array['gac','mergers','concentration'],
   'https://gacbep.gac.gov.sa/cms/912a9673-01a9-4737-a480-f8f65783205f.pdf',
   'إصدار 5 — أبريل 2025', 'Edition 5 — April 2025',
   '2025-04-01'),
  ('e0000000-0000-0000-0000-000000000004',
   'الدليل الإرشادي للتعامل مع الاتفاقيات الرأسية والأفقية',
   'Guidelines on horizontal and vertical agreements',
   'official_guide', null,
   array['gac','agreements','antitrust'],
   'https://gacbep.gac.gov.sa/cms/9e6286ba-8c8c-4713-ba2d-3f48cdaa368c.pdf',
   'يوليو 2025','July 2025','2025-07-01'),
  ('e0000000-0000-0000-0000-000000000005',
   'دليل تعزيز المنافسة في قطاع منصّات توصيل الطعام',
   'Guideline for promoting competition in food-delivery platforms',
   'official_guide', null,
   array['gac','digital-platforms','delivery'],
   'https://istitlaa.ncc.gov.sa/ar/Trade/gac/guidelinecompetitioninfooddeliveryplatform/Pages/default.aspx',
   'فبراير 2026','February 2026','2026-02-01'),
  ('e0000000-0000-0000-0000-000000000006',
   'دليل الامتثال لنظام المنافسة ولائحته التنفيذية',
   'Compliance guide for the Competition Law and its bylaws',
   'official_guide', null,
   array['gac','compliance','law'],
   'https://beta.gac.gov.sa/APIGateway/api/Attachment/ShowAttachment/c60fbcce-1fc4-411f-84ec-e6aee182b6e4',
   'ديسمبر 2021','December 2021','2021-12-01'),
  ('e0000000-0000-0000-0000-000000000007',
   'الإرشادات العامة لمكافحة التواطؤ بين مقدّمي العروض في المنافسات العامة',
   'Guidelines on combating bid-rigging in public tenders',
   'official_guide', null,
   array['gac','enforcement','bid-rigging'],
   'https://beta.gac.gov.sa/APIGateway/api/Attachment/ShowAttachment/ed31a355-4716-44dd-a98b-301637263aa3',
   '2021–2022','2021–2022','2022-01-01'),
  ('e0000000-0000-0000-0000-000000000008',
   'المعجم العربي للمنافسة',
   'Arabic competition glossary',
   'official_guide', null,
   array['gac','reference','glossary'],
   'https://acnbe.gac.gov.sa/Assets/pdfUploads/638658814392983212_%D8%A7%D9%84%D9%85%D8%B9%D8%AC%D9%85%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%20%D9%84%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20-%20%D8%A7%D9%84%D9%87%D9%8A%D8%A6%D8%A9%20%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9%20%D9%84%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20%D8%A8%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9.pdf',
   '2022','2022','2022-01-01'),
  ('e0000000-0000-0000-0000-000000000009',
   'سياسة الخصوصية — الإصدار الأول',
   'Privacy policy — version 1',
   'official_guide', null,
   array['gac','privacy','policy'],
   'https://gacbep.gac.gov.sa/cms/V1_%D8%A7%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AE%D8%B5%D9%88%D8%B5%D9%8A%D8%A9_15-10-2024_.pdf',
   'أكتوبر 2024','October 2024','2024-10-15'),
  ('e0000000-0000-0000-0000-000000000010',
   'التقرير السنوي لشبكة المنافسة العربية',
   'Arab Competition Network — annual report',
   'official_guide', null,
   array['gac','arab-network','annual-report'],
   'https://acnbe.gac.gov.sa/Assets/pdfUploads/638658818107911912_%D8%A7%D9%84%D8%AA%D9%82%D8%B1%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B3%D9%86%D9%88%D9%8A%20%D9%84%D8%B4%D8%A8%D9%83%D8%A9%20%D8%A7%D9%84%D9%85%D9%86%D8%A7%D9%81%D8%B3%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%202023-2024.pdf',
   '2023–2024','2023–2024','2024-01-01')
on conflict (id) do nothing;
