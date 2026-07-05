-- Migration 00021 — Seed dashboard widget toggles into cms_blocks
--
-- Purpose: enable admins to show/hide dashboard widgets from /admin/cms,
-- mirroring the pattern from the GAC hackathon prototype (const WIDGETS[] +
-- renderToggles()). Each widget id becomes a section-toggle row on
-- page='dashboard' so isSectionEnabled(cms, id) drives visibility.
--
-- Idempotent:
--   • Only inserts rows that don't already exist (matched by page+section+key).
--   • Never overwrites an admin-authored enabled/value.
--   • No-op if innovation.cms_blocks isn't present yet.
--
-- After this runs, the CMS editor at /admin/cms shows a new "Dashboard" tab
-- with a toggle for each widget (quick actions, announcements, events, ...).

do $$
begin
  if not exists (
    select 1
      from information_schema.tables
     where table_schema = 'innovation'
       and table_name  = 'cms_blocks'
  ) then
    raise notice 'innovation.cms_blocks not present — dashboard widget seed skipped.';
    return;
  end if;

  -- One section-toggle row per widget. key = NULL by convention (see cms.ts
  -- keyOf: section-level toggles use "__section__" internally).
  insert into innovation.cms_blocks (page, section, key, kind, enabled, value_en, value_ar, sort_order)
  values
    ('dashboard', 'quick_actions',     null, 'section', true, 'Quick actions',        'الإجراءات السريعة', 10),
    ('dashboard', 'announcements',     null, 'section', true, 'Latest announcements', 'آخر الإعلانات',      20),
    ('dashboard', 'events',            null, 'section', true, 'Events & workshops',   'الفعاليات والورش',   30),
    ('dashboard', 'my_recent_ideas',   null, 'section', true, 'My recent ideas',      'أفكاري الأخيرة',     40),
    ('dashboard', 'gamification',      null, 'section', true, 'Points & badges',      'النقاط والشارات',    50),
    ('dashboard', 'platform_activity', null, 'section', true, 'Platform activity',    'نشاط المنصة',        60),
    ('dashboard', 'journey_status',    null, 'section', true, 'Journey status',       'نظرة على الرحلة',    70),
    ('dashboard', 'timeline',          null, 'section', true, 'Roadmap timeline',     'الجدول الزمني',      80)
  on conflict (page, section, key) do nothing;

  raise notice 'Dashboard widget toggle rows seeded (or already present).';
end
$$;
