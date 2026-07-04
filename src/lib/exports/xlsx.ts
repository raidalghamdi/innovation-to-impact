// Excel export (exceljs) with design-foundations styling. Produces multi-sheet
// workbooks as a Buffer for streaming from route handlers.
import ExcelJS from 'exceljs';
import { argb, BRAND, FONT_LATIN, generationFooter, insightTitle } from './branding';
import { gatherIdeasDataset, themeName, userName, type ExportFilters } from './dataset';
import { fetchAuditPage, type AuditFilters } from '@/lib/data';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: argb(BRAND.primary) },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: FONT_LATIN,
  bold: true,
  color: { argb: argb(BRAND.white) },
  size: 11,
};
const BODY_FONT: Partial<ExcelJS.Font> = { name: FONT_LATIN, size: 10 };
const INT_FMT = '#,##0';
const DEC_FMT = '#,##0.0';

type Column = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

// Apply the shared header styling + freeze the first row and set column widths.
function styleSheet(ws: ExcelJS.Worksheet, columns: Column[]) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  const header = ws.getRow(1);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  header.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  columns.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
}

function tallyBy<T>(rows: T[], keyOf: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = keyOf(r) || '—';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export type WorkbookOpts = {
  filters?: ExportFilters;
  locale?: string;
  generatedBy: string;
};

export async function exportIdeasWorkbook(opts: WorkbookOpts): Promise<Buffer> {
  const locale = opts.locale ?? 'en';
  const { ideas, themeById, userById, evaluations, decisions } = await gatherIdeasDataset(
    opts.filters ?? {}
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = opts.generatedBy;
  wb.created = new Date();

  const approved = decisions.filter((d) => d.decision === 'approve').length;

  // --- Sheet 1: Overview -----------------------------------------------------
  const overview = wb.addWorksheet('Overview');
  overview.mergeCells('A1:C1');
  const titleCell = overview.getCell('A1');
  titleCell.value = insightTitle(
    'Ideas',
    [
      { label: 'total', count: ideas.length },
      { label: 'approved', count: approved },
    ],
    locale
  );
  titleCell.font = { name: FONT_LATIN, bold: true, size: 14, color: { argb: argb(BRAND.text) } };
  overview.addRow([]);

  const writeTally = (heading: string, tally: Record<string, number>) => {
    const hr = overview.addRow([heading, 'Count']);
    hr.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.font = HEADER_FONT;
    });
    for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
      const row = overview.addRow([k, v]);
      row.getCell(1).font = BODY_FONT;
      const n = row.getCell(2);
      n.font = BODY_FONT;
      n.numFmt = INT_FMT;
    }
    overview.addRow([]);
  };

  writeTally('By status', tallyBy(ideas, (i) => i.status));
  writeTally(
    'By pillar',
    tallyBy(ideas, (i) => themeName(themeById.get(i.strategic_theme_id), locale))
  );
  writeTally('By decision', tallyBy(decisions, (d) => d.decision));
  overview.getColumn(1).width = 42;
  overview.getColumn(2).width = 12;

  // --- Sheet 2: Ideas --------------------------------------------------------
  const ideasSheet = wb.addWorksheet('Ideas');
  styleSheet(ideasSheet, [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Title (AR)', key: 'title_ar', width: 34 },
    { header: 'Title (EN)', key: 'title_en', width: 34 },
    { header: 'Submitter', key: 'submitter', width: 22 },
    { header: 'Pillar', key: 'pillar', width: 28 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Submitted', key: 'submitted', width: 14 },
    { header: 'Decision date', key: 'decided', width: 14 },
  ]);
  const decidedByIdea = new Map(decisions.map((d) => [d.idea_id, d.decided_at]));
  for (const i of ideas) {
    const row = ideasSheet.addRow({
      code: i.code,
      title_ar: i.title_ar,
      title_en: i.title_en,
      submitter: userName(userById.get(i.submitter_id)),
      pillar: themeName(themeById.get(i.strategic_theme_id), locale),
      status: i.status,
      submitted: i.created_at?.slice(0, 10) ?? '',
      decided: decidedByIdea.get(i.id)?.slice(0, 10) ?? '',
    });
    row.font = BODY_FONT;
    row.getCell('title_ar').alignment = { horizontal: 'right', readingOrder: 'rtl' };
  }

  // --- Sheet 3: Evaluations --------------------------------------------------
  const evalSheet = wb.addWorksheet('Evaluations');
  // Union of all criterion keys across the dataset → dynamic score columns.
  const criteriaKeys = Array.from(
    new Set(
      Object.values(evaluations).flatMap((s) =>
        s.scorecards.flatMap((sc) => Object.keys(sc.criteriaScores ?? {}))
      )
    )
  ).sort();
  const evalColumns: Column[] = [
    { header: 'Idea code', key: 'code', width: 16 },
    { header: 'Evaluator', key: 'evaluator', width: 24 },
    { header: 'Total', key: 'total', width: 10, numFmt: DEC_FMT },
    ...criteriaKeys.map((k) => ({ header: k, key: `c_${k}`, width: 14, numFmt: DEC_FMT })),
    { header: 'Conflict', key: 'conflict', width: 10 },
    { header: 'Submitted', key: 'submitted', width: 14 },
  ];
  styleSheet(evalSheet, evalColumns);
  const codeByIdea = new Map(ideas.map((i) => [i.id, i.code]));
  for (const [ideaId, summary] of Object.entries(evaluations)) {
    for (const sc of summary.scorecards) {
      const rowValues: Record<string, string | number | boolean> = {
        code: codeByIdea.get(ideaId) ?? ideaId,
        evaluator: sc.evaluatorName,
        total: sc.totalScore ?? 0,
        conflict: sc.conflict ? 'yes' : 'no',
        submitted: sc.submittedAt?.slice(0, 10) ?? '',
      };
      for (const k of criteriaKeys) rowValues[`c_${k}`] = sc.criteriaScores?.[k] ?? 0;
      evalSheet.addRow(rowValues).font = BODY_FONT;
    }
  }

  // --- Sheet 4: Committee Decisions -----------------------------------------
  const decSheet = wb.addWorksheet('Committee Decisions');
  styleSheet(decSheet, [
    { header: 'Idea code', key: 'code', width: 16 },
    { header: 'Committee', key: 'committee', width: 22 },
    { header: 'Decision', key: 'decision', width: 16 },
    { header: 'Quorum met', key: 'quorum', width: 12 },
    { header: 'Comments', key: 'comments', width: 40 },
    { header: 'Decided at', key: 'decided', width: 14 },
    { header: 'Decided by', key: 'decidedBy', width: 24 },
  ]);
  for (const d of decisions) {
    decSheet.addRow({
      code: codeByIdea.get(d.idea_id) ?? d.idea_id,
      committee: d.committee_name ?? '',
      decision: d.decision,
      quorum: d.quorum_met ? 'yes' : 'no',
      comments: d.comments ?? '',
      decided: d.decided_at?.slice(0, 10) ?? '',
      decidedBy: userName(userById.get(d.decided_by ?? '')),
    }).font = BODY_FONT;
  }

  // Traceability footer on the overview sheet.
  const footer = overview.addRow([generationFooter(opts.generatedBy, locale)]);
  footer.getCell(1).font = { name: FONT_LATIN, italic: true, size: 9, color: { argb: argb(BRAND.muted) } };

  // exceljs types xlsx.writeBuffer as Promise<ArrayBuffer>; wrap for Node.
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export type AuditWorkbookOpts = {
  filters?: AuditFilters;
  locale?: string;
  generatedBy: string;
};

// Formatted XLSX version of the WS1 audit CSV export. Pages through the full
// filtered ledger (cap 20k rows) and writes it with the shared styling.
export async function exportAuditWorkbook(opts: AuditWorkbookOpts): Promise<Buffer> {
  const locale = opts.locale ?? 'en';
  const base: AuditFilters = { ...(opts.filters ?? {}), pageSize: 1000 };

  const wb = new ExcelJS.Workbook();
  wb.creator = opts.generatedBy;
  wb.created = new Date();
  const ws = wb.addWorksheet('Audit Log');
  styleSheet(ws, [
    { header: 'Created at', key: 'created_at', width: 22 },
    { header: 'Seq', key: 'chain_seq', width: 8, numFmt: INT_FMT },
    { header: 'Actor', key: 'actor', width: 26 },
    { header: 'Action', key: 'action', width: 28 },
    { header: 'Entity type', key: 'entity_type', width: 20 },
    { header: 'Entity id', key: 'entity_id', width: 38 },
    { header: 'Row hash', key: 'row_hash', width: 44 },
  ]);

  let totalRows = 0;
  for (let page = 1; page <= 20; page++) {
    const { rows, total, pageSize, actorLabels } = await fetchAuditPage({ ...base, page });
    for (const r of rows) {
      ws.addRow({
        created_at: r.created_at,
        chain_seq: r.chain_seq,
        actor: r.actor_id ? actorLabels[r.actor_id] ?? r.actor_id : '',
        action: r.action,
        entity_type: r.entity_type,
        entity_id: r.entity_id ?? '',
        row_hash: r.row_hash,
      }).font = BODY_FONT;
      totalRows += 1;
    }
    if (page * pageSize >= total || rows.length === 0) break;
  }

  ws.spliceRows(1, 0, [insightTitle('Audit log', [{ label: 'entries', count: totalRows }], locale)]);
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.font = { name: FONT_LATIN, bold: true, size: 13, color: { argb: argb(BRAND.text) } };
  // Re-freeze below the inserted title + header rows.
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  const footer = ws.addRow([generationFooter(opts.generatedBy, locale)]);
  footer.getCell(1).font = { name: FONT_LATIN, italic: true, size: 9, color: { argb: argb(BRAND.muted) } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
