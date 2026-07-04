-- Migration 00016 — Remove QA placeholder overrides from CMS
--
-- Purpose: an earlier QA run left overrides in innovation.cms_blocks for the
-- landing page hero (specifically value_ar = 'QA اختبار AR'). Because the CMS
-- layer wins over the messages/*.json defaults, the Arabic homepage subtitle
-- rendered the placeholder text in production.
--
-- We delete any cms_blocks row on page='landing', section='hero' whose value_ar
-- OR value_en still contains a QA/test marker. This is idempotent — if the
-- rows were already removed by the CMS admin UI, the delete is a no-op.
--
-- Safe by design:
--   • Scoped to page='landing' + section='hero' only.
--   • Only matches rows still carrying obvious QA markers ('QA اختبار',
--     'QA test', 'QA AR', 'اختبار AR').
--   • Never touches production-authored copy that doesn't contain those
--     markers.
--
-- After this runs, the landing hero falls back to messages/{en,ar}.json —
-- landing.heroTitle / landing.heroSubtitle — which is the intended source of
-- truth for the marketing page copy.

do $$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'innovation'
       and table_name  = 'cms_blocks'
  ) then
    delete from innovation.cms_blocks
     where page    = 'landing'
       and section = 'hero'
       and (
            coalesce(value_ar,'') ilike '%QA اختبار%'
         or coalesce(value_ar,'') ilike '%اختبار AR%'
         or coalesce(value_en,'') ilike '%QA test%'
         or coalesce(value_en,'') ilike '%QA AR%'
         or coalesce(value_en,'') ilike '%placeholder%'
       );
    raise notice 'QA placeholder cms_blocks rows removed for landing/hero (if any existed).';
  else
    raise notice 'innovation.cms_blocks not present — nothing to clean up.';
  end if;
end $$;

-- Verification query (run manually in Supabase UI):
--   select page, section, key, value_ar, value_en
--     from innovation.cms_blocks
--    where page='landing' and section='hero';
-- Expect: no rows containing 'QA' or 'اختبار'.
