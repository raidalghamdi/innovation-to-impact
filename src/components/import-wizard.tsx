'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importCsv } from '@/app/[locale]/admin/import/actions';
import {
  ENTITY_FIELDS,
  type ImportEntity,
  type ImportResult,
} from '@/lib/import-schema';

const ENTITIES: ImportEntity[] = ['ideas', 'evaluators', 'strategic_themes'];
const PREVIEW_ROWS = 20;
const NONE = '__none__';

// Auto-map a target field to a CSV header by matching the field's aliases.
function autoDetect(field: string, aliases: string[], headers: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const wanted = new Set([field, ...aliases].map(norm));
  const hit = headers.find((h) => wanted.has(norm(h)));
  return hit ?? NONE;
}

export function ImportWizard({ locale }: { locale: string }) {
  const t = useTranslations('import');
  const isAr = locale === 'ar';
  const [entity, setEntity] = useState<ImportEntity>('ideas');
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const fields = useMemo(() => ENTITY_FIELDS[entity], [entity]);

  function remapForEntity(nextEntity: ImportEntity, hdrs: string[]) {
    const next: Record<string, string> = {};
    for (const def of ENTITY_FIELDS[nextEntity]) {
      next[def.field] = autoDetect(def.field, def.aliases, hdrs);
    }
    setMapping(next);
  }

  function onFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsvText(text);
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: PREVIEW_ROWS + 1,
      });
      const hdrs = parsed.meta.fields ?? [];
      setHeaders(hdrs);
      setPreview((parsed.data ?? []).slice(0, PREVIEW_ROWS));
      remapForEntity(entity, hdrs);
    };
    reader.readAsText(file);
  }

  function onEntityChange(next: ImportEntity) {
    setEntity(next);
    setResult(null);
    if (headers.length) remapForEntity(next, headers);
  }

  function runImport() {
    setResult(null);
    startTransition(async () => {
      const res = await importCsv(entity, csvText, mapping);
      setResult(res);
    });
  }

  const requiredUnmapped = fields
    .filter((f) => f.required && (!mapping[f.field] || mapping[f.field] === NONE))
    .map((f) => f.field);
  const canImport = csvText.length > 0 && requiredUnmapped.length === 0 && !pending;

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Entity picker */}
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEntityChange(e)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              entity === e
                ? 'border-brand-teal bg-brand-teal text-white'
                : 'border-border bg-card text-muted-foreground hover:border-brand-teal/40'
            }`}
          >
            {t(`entity.${e}`)}
          </button>
        ))}
      </div>

      {/* File input */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition hover:border-brand-teal/40"
      >
        <UploadCloud className="h-6 w-6 text-brand-teal" />
        <span className="text-sm font-medium">{t('pickFile')}</span>
        <span className="text-xs text-muted-foreground">{t('pickHint')}</span>
        <input
          ref={inputRef}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) onFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>

      {headers.length > 0 && (
        <>
          {/* Column mapping */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-brand-teal">{t('mapColumns')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.field} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {f.field}
                    {f.required && <span className="text-red-600"> *</span>}
                  </span>
                  <select
                    value={mapping[f.field] ?? NONE}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.field]: e.target.value }))}
                    className="h-9 rounded-md border border-input bg-white px-2 text-sm"
                  >
                    <option value={NONE}>{t('unmapped')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {requiredUnmapped.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('requiredUnmapped', { fields: requiredUnmapped.join(', ') })}
              </p>
            )}
          </div>

          {/* Preview table */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-brand-teal">
              {t('preview', { n: preview.length })}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-start font-semibold text-brand-teal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {headers.map((h) => (
                        <td key={h} className="max-w-[16rem] truncate px-3 py-1.5 text-muted-foreground">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Button onClick={runImport} disabled={!canImport}>
            {pending ? t('importing') : t('importValid')}
          </Button>
        </>
      )}

      {/* Result summary */}
      {result && (
        <div
          className={`rounded-xl border p-4 ${
            result.ok ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            {result.ok
              ? t('resultOk', { inserted: result.inserted, skipped: result.skipped })
              : t('resultError', { error: result.error ?? '' })}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-700">
              {result.errors.slice(0, 50).map((err, i) => (
                <li key={i}>
                  {t('rowError', { row: err.row, field: err.field, message: t(`err.${err.message}`) })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
