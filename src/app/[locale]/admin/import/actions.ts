'use server';

import { randomUUID } from 'crypto';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import {
  ENTITY_FIELDS,
  type ImportEntity,
  type FieldDef,
  type RowError,
  type ImportResult,
} from '@/lib/import-schema';

// Bulk CSV import (WS7 F2). Admin-only. The client sends the raw CSV text plus a
// column mapping (targetField -> csvHeader); the server parses with papaparse,
// validates each row against the entity schema, and inserts the valid ones.
// Field definitions/types live in `@/lib/import-schema` so client wizards can
// import them without pulling this 'use server' module.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateValue(def: FieldDef, raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) {
    return def.required ? 'required' : null;
  }
  if (def.type === 'email' && !EMAIL_RE.test(value)) return 'invalid_email';
  if (def.type === 'uuid' && !UUID_RE.test(value)) return 'invalid_uuid';
  return null;
}

export async function importCsv(
  entity: ImportEntity,
  csvText: string,
  mapping: Record<string, string>
): Promise<ImportResult> {
  const defs = ENTITY_FIELDS[entity];
  if (!defs) return { ok: false, inserted: 0, skipped: 0, errors: [], error: 'invalid_entity' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, inserted: 0, skipped: 0, errors: [], error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return { ok: false, inserted: 0, skipped: 0, errors: [], error: 'forbidden' };
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data ?? [];

  // For ideas, prefetch valid theme ids so an FK mismatch is caught per-row
  // instead of failing the whole insert.
  let validThemeIds: Set<string> | null = null;
  if (entity === 'ideas') {
    try {
      const { data } = await supabase.from('strategic_themes').select('id');
      validThemeIds = new Set(((data as { id: string }[]) ?? []).map((r) => r.id));
    } catch {
      validThemeIds = null;
    }
  }

  const errors: RowError[] = [];
  const validRows: Record<string, unknown>[] = [];

  rows.forEach((rawRow, idx) => {
    const rowNum = idx + 2; // +1 for 0-index, +1 for header line
    const mapped: Record<string, string> = {};
    let rowHasError = false;

    for (const def of defs) {
      const header = mapping[def.field];
      const value = header ? rawRow[header] : undefined;
      const err = validateValue(def, value);
      if (err) {
        errors.push({ row: rowNum, field: def.field, message: err });
        rowHasError = true;
      } else if (value != null && value.trim()) {
        mapped[def.field] = value.trim();
      }
    }

    if (
      !rowHasError &&
      entity === 'ideas' &&
      mapped.strategic_theme_id &&
      validThemeIds &&
      !validThemeIds.has(mapped.strategic_theme_id)
    ) {
      errors.push({ row: rowNum, field: 'strategic_theme_id', message: 'fk_mismatch' });
      rowHasError = true;
    }

    if (rowHasError) return;
    validRows.push(buildInsertRow(entity, mapped, user.id));
  });

  let inserted = 0;
  if (validRows.length > 0) {
    const table = entity === 'evaluators' ? 'user_profiles' : entity;
    const { data, error } = await supabase.from(table).insert(validRows).select('id');
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[importCsv] insert error:', error);
      return {
        ok: false,
        inserted: 0,
        skipped: rows.length,
        errors,
        error: error.message,
      };
    }
    inserted = (data as unknown[])?.length ?? validRows.length;
  }

  const skipped = rows.length - inserted;
  await logAudit(user.id, 'import.csv', entity, null, {
    after: { entity, total: rows.length, inserted, skipped, first_errors: errors.slice(0, 5) },
  });

  return { ok: true, inserted, skipped, errors };
}

function buildInsertRow(
  entity: ImportEntity,
  mapped: Record<string, string>,
  actorId: string
): Record<string, unknown> {
  if (entity === 'ideas') {
    return {
      title_en: mapped.title_en ?? null,
      title_ar: mapped.title_ar ?? null,
      problem_statement: mapped.problem_statement ?? null,
      proposed_solution: mapped.proposed_solution ?? null,
      strategic_theme_id: mapped.strategic_theme_id ?? null,
      status: 'submitted',
      current_stage: 1,
      submitter_id: actorId,
    };
  }
  if (entity === 'evaluators') {
    return {
      id: randomUUID(),
      email: mapped.email ?? null,
      full_name: mapped.full_name ?? null,
      full_name_ar: mapped.full_name_ar ?? null,
      role: 'evaluator',
    };
  }
  // strategic_themes
  return {
    name_en: mapped.name_en ?? null,
    name_ar: mapped.name_ar ?? null,
    description: mapped.description ?? null,
  };
}
