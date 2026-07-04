// Bulk-import entity schema. Kept out of the 'use server' actions module so
// client wizards (import-wizard.tsx) can import the field definitions and
// types without hitting Next.js's "server files only export async functions"
// constraint.

export type ImportEntity = 'ideas' | 'evaluators' | 'strategic_themes';

export type FieldDef = {
  field: string;
  required: boolean;
  type: 'string' | 'uuid' | 'email';
  // Header aliases used for auto-detection (lowercased, matched loosely).
  aliases: string[];
};

export type RowError = { row: number; field: string; message: string };

export type ImportResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: RowError[];
  error?: string;
};

export const ENTITY_FIELDS: Record<ImportEntity, FieldDef[]> = {
  ideas: [
    { field: 'title_en', required: true, type: 'string', aliases: ['title_en', 'title', 'title en', 'english title'] },
    { field: 'title_ar', required: false, type: 'string', aliases: ['title_ar', 'arabic title', 'العنوان'] },
    { field: 'problem_statement', required: true, type: 'string', aliases: ['problem_statement', 'problem', 'summary'] },
    { field: 'proposed_solution', required: false, type: 'string', aliases: ['proposed_solution', 'solution', 'description'] },
    { field: 'strategic_theme_id', required: false, type: 'uuid', aliases: ['strategic_theme_id', 'theme_id', 'theme'] },
  ],
  evaluators: [
    { field: 'email', required: true, type: 'email', aliases: ['email', 'e-mail', 'mail'] },
    { field: 'full_name', required: true, type: 'string', aliases: ['full_name', 'name', 'full name'] },
    { field: 'full_name_ar', required: false, type: 'string', aliases: ['full_name_ar', 'arabic name', 'الاسم'] },
  ],
  strategic_themes: [
    { field: 'name_en', required: true, type: 'string', aliases: ['name_en', 'name', 'english name'] },
    { field: 'name_ar', required: false, type: 'string', aliases: ['name_ar', 'arabic name'] },
    { field: 'description', required: false, type: 'string', aliases: ['description', 'desc'] },
  ],
};
