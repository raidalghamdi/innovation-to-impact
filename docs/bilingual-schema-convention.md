# Bilingual schema convention

The platform is Arabic-first and fully bilingual (AR/EN). UI chrome is handled by
next-intl message files (`messages/ar.json`, `messages/en.json`). This document
covers the **other** half: user-generated / DB-stored content.

## The rule

Every user-facing text column MUST exist as a parallel pair:

```
<field>_ar   -- Arabic value
<field>_en   -- English value
```

Single-language columns (e.g. a bare `description`) are deprecated. Migration
`supabase/migrations/00008_bilingual_columns.sql` adds the missing variants and
backfills them from the legacy column. Legacy columns are kept for backward
compatibility but should no longer be read directly in new code.

## Read path

Use the helpers in `src/lib/i18n-content.ts` — never inline a
`locale === 'ar' ? row.x_ar : row.x_en` ternary.

```ts
import { pick, pickFromRow, pickServer } from '@/lib/i18n-content';

// When you already hold both values (or non-row labels):
pick(row.title_ar, row.title_en, locale);

// When you have a row + a base field name (applies the fallback rule):
pickFromRow(row, 'title', locale);        // -> string

// Server Components / actions — resolves the locale for you:
await pickServer(row, 'title');
```

`locale` is threaded as a plain `string` throughout the app; any value other
than `'ar'` resolves to the English variant.

## Write path

Forms render two inputs side-by-side (Arabic + English) and persist both
columns. Do not auto-translate on save; capture author intent in each language.

## Fallback rule

`pickFromRow` (and `pickServer`) apply:

| Active locale | Resolution order |
|---------------|------------------|
| `ar`          | `<field>_ar` ?? `<field>_en` ?? `''` |
| `en`          | `<field>_en` ?? `<field>_ar` ?? `''` |

So a value entered in only one language still renders in the other locale rather
than showing blank.

## Columns covered by 00008

| Table | Already bilingual | Variants added |
|-------|-------------------|----------------|
| `ideas` | `title_ar` / `title_en` | `problem_statement`, `proposed_solution`, `expected_benefits` |
| `strategic_themes` | `name_ar` / `name_en` | `description` |
| `activities` | `name_ar` / `name_en` | `target_audience` |
| `benefits` | — | `title`, `description` (new, no legacy source) |

New tables and columns added after this point are expected to follow the same
`_ar` / `_en` pattern from the outset.
