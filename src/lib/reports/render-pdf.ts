// Generic PDF renderer for any ReportBundle. Uses pdf-lib + fontkit with an
// embedded Frutiger LT Arabic (aligned with the platform style guide the user
// provided). RTL/Arabic runs are shaped by fontkit's layout() pass, so the
// result reads natively.
//
// Layout: A4 portrait, LEFT-aligned content, single-column. Header (title +
// meta), KPI grid, then each section as a titled table.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportBundle } from './types';
import { REPORT_META } from './types';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const PRIMARY = rgb(0x01 / 255, 0x69 / 255, 0x6f / 255);
const TEXT = rgb(0x28 / 255, 0x25 / 255, 0x1d / 255);
const MUTED = rgb(0x7a / 255, 0x79 / 255, 0x74 / 255);
const BORDER = rgb(0xd4 / 255, 0xd1 / 255, 0xca / 255);
const SURFACE = rgb(0xf7 / 255, 0xf6 / 255, 0xf2 / 255);

const FONT_DIR = path.join(process.cwd(), 'src/lib/reports/assets/fonts');
const IBM_DIR = path.join(process.cwd(), 'src/lib/exports/fonts');

function readFontSafe(...tryPaths: string[]): Uint8Array | null {
  for (const p of tryPaths) {
    try {
      return fs.readFileSync(p);
    } catch {
      // continue
    }
  }
  return null;
}

type Fonts = { reg: PDFFont; bold: PDFFont; ar: PDFFont; arBold: PDFFont };

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Prefer Frutiger Arabic; fallback to IBM Plex Sans Arabic; last resort Helvetica.
  const arBytes = readFontSafe(
    path.join(FONT_DIR, 'frutiger-arabic-regular.ttf'),
    path.join(IBM_DIR, 'ibm-plex-sans-arabic-400.ttf')
  );
  const arBoldBytes = readFontSafe(
    path.join(FONT_DIR, 'frutiger-arabic-bold.ttf'),
    path.join(IBM_DIR, 'ibm-plex-sans-arabic-700.ttf')
  );
  const ar = arBytes ? await doc.embedFont(arBytes, { subset: true }) : reg;
  const arBold = arBoldBytes ? await doc.embedFont(arBoldBytes, { subset: true }) : bold;
  return { reg, bold, ar, arBold };
}

// Detect Arabic runs so we pick the right font (fontkit handles shaping).
const HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function pickFont(text: string, fonts: Fonts, bold = false): PDFFont {
  if (HAS_ARABIC.test(text)) return bold ? fonts.arBold : fonts.ar;
  return bold ? fonts.bold : fonts.reg;
}

// Truncate `text` so it fits in `maxWidth` at `size`. Uses widthOfTextAtSize().
function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const cand = text.slice(0, mid) + ellipsis;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  y: number;
  locale: 'ar' | 'en';
};

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 30) newPage(ctx);
}

function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}
) {
  const size = opts.size ?? 10;
  const font = pickFont(text, ctx.fonts, !!opts.bold);
  ctx.page.drawText(text, {
    x,
    y,
    size,
    font,
    color: opts.color ?? TEXT,
  });
}

function drawHeader(ctx: Ctx, bundle: ReportBundle) {
  const meta = REPORT_META[bundle.type];
  const title = ctx.locale === 'ar' ? meta.name_ar : meta.name_en;
  const rangeLabel = (() => {
    if (!bundle.dateFrom && !bundle.dateTo) return ctx.locale === 'ar' ? 'كل الفترات' : 'All time';
    return `${bundle.dateFrom ?? '…'} → ${bundle.dateTo ?? '…'}`;
  })();

  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - 90,
    width: PAGE_W,
    height: 90,
    color: PRIMARY,
  });
  ctx.page.drawText(title, {
    x: MARGIN,
    y: PAGE_H - 45,
    size: 22,
    font: pickFont(title, ctx.fonts, true),
    color: rgb(1, 1, 1),
  });
  const subtitle = ctx.locale === 'ar' ? 'منصة الابتكار للأثر' : 'Innovation-to-Impact Platform';
  ctx.page.drawText(subtitle, {
    x: MARGIN,
    y: PAGE_H - 68,
    size: 10,
    font: pickFont(subtitle, ctx.fonts, false),
    color: rgb(1, 1, 1),
  });
  ctx.page.drawText(rangeLabel, {
    x: MARGIN,
    y: PAGE_H - 82,
    size: 9,
    font: ctx.fonts.reg,
    color: rgb(0.9, 0.95, 0.94),
  });
  ctx.y = PAGE_H - 110;
}

function drawKpis(ctx: Ctx, bundle: ReportBundle) {
  if (!bundle.kpis.length) return;
  const cardW = (PAGE_W - MARGIN * 2 - 8 * 2) / 3;
  const cardH = 54;
  ensureSpace(ctx, cardH + 20);
  const startY = ctx.y - cardH;
  bundle.kpis.slice(0, 6).forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * (cardW + 8);
    const y = startY - row * (cardH + 8);
    ctx.page.drawRectangle({
      x,
      y,
      width: cardW,
      height: cardH,
      color: SURFACE,
      borderColor: BORDER,
      borderWidth: 0.5,
    });
    const label = ctx.locale === 'ar' ? kpi.label_ar : kpi.label_en;
    ctx.page.drawText(fitText(label, pickFont(label, ctx.fonts, false), 9, cardW - 16), {
      x: x + 8,
      y: y + cardH - 16,
      size: 9,
      font: pickFont(label, ctx.fonts, false),
      color: MUTED,
    });
    ctx.page.drawText(kpi.value, {
      x: x + 8,
      y: y + 12,
      size: 20,
      font: pickFont(kpi.value, ctx.fonts, true),
      color: PRIMARY,
    });
  });
  const rows = Math.ceil(Math.min(bundle.kpis.length, 6) / 3);
  ctx.y = startY - (rows - 1) * (cardH + 8) - 20;
}

function drawSection(
  ctx: Ctx,
  section: ReportBundle['sections'][number]
) {
  const title = ctx.locale === 'ar' ? section.title_ar : section.title_en;
  ensureSpace(ctx, 40);
  drawText(ctx, title, MARGIN, ctx.y - 12, { size: 13, bold: true });
  ctx.y -= 24;

  const availableWidth = PAGE_W - MARGIN * 2;
  const totalWeight = section.columns.reduce((acc, c) => acc + (c.width ?? 20), 0);
  const colWidths = section.columns.map((c) => ((c.width ?? 20) / totalWeight) * availableWidth);

  // Header row
  ensureSpace(ctx, 22);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 18,
    width: availableWidth,
    height: 18,
    color: PRIMARY,
  });
  let cx = MARGIN;
  for (let i = 0; i < section.columns.length; i++) {
    const c = section.columns[i];
    const label = ctx.locale === 'ar' ? c.label_ar : c.label_en;
    const font = pickFont(label, ctx.fonts, true);
    ctx.page.drawText(fitText(label, font, 9, colWidths[i] - 8), {
      x: cx + 6,
      y: ctx.y - 12,
      size: 9,
      font,
      color: rgb(1, 1, 1),
    });
    cx += colWidths[i];
  }
  ctx.y -= 20;

  // Rows
  if (!section.rows.length) {
    const empty = ctx.locale === 'ar' ? 'لا توجد بيانات ضمن هذا النطاق.' : 'No data in this range.';
    drawText(ctx, empty, MARGIN, ctx.y - 12, { size: 10, color: MUTED });
    ctx.y -= 24;
    return;
  }

  for (const row of section.rows) {
    ensureSpace(ctx, 18);
    // Alternating band
    if ((section.rows.indexOf(row) & 1) === 1) {
      ctx.page.drawRectangle({
        x: MARGIN,
        y: ctx.y - 15,
        width: availableWidth,
        height: 15,
        color: SURFACE,
      });
    }
    let ccx = MARGIN;
    for (let i = 0; i < section.columns.length; i++) {
      const c = section.columns[i];
      const raw = row[c.key];
      const text = raw === null || raw === undefined ? '' : String(raw);
      const font = pickFont(text, ctx.fonts, false);
      ctx.page.drawText(fitText(text, font, 8.5, colWidths[i] - 8), {
        x: ccx + 6,
        y: ctx.y - 10,
        size: 8.5,
        font,
        color: TEXT,
      });
      ccx += colWidths[i];
    }
    ctx.y -= 15;
  }
  ctx.y -= 16;
}

function drawFooter(ctx: Ctx, bundle: ReportBundle) {
  const stamp = new Date(bundle.generatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const footer =
    ctx.locale === 'ar'
      ? `أُنشئ بواسطة ${bundle.generatedBy} · ${stamp}`
      : `Generated by ${bundle.generatedBy} · ${stamp}`;
  const totalPages = ctx.doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = ctx.doc.getPage(i);
    const font = pickFont(footer, ctx.fonts, false);
    p.drawText(footer, {
      x: MARGIN,
      y: 20,
      size: 8,
      font,
      color: MUTED,
    });
    const pageLabel = `${i + 1} / ${totalPages}`;
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN - ctx.fonts.reg.widthOfTextAtSize(pageLabel, 8),
      y: 20,
      size: 8,
      font: ctx.fonts.reg,
      color: MUTED,
    });
  }
}

export async function renderPdf(
  bundle: ReportBundle,
  locale: 'ar' | 'en' = 'en'
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${REPORT_META[bundle.type].name_en} — I2I`);
  doc.setAuthor('Innovation-to-Impact Platform');
  doc.setSubject('Innovation report');
  doc.setCreator('Innovation-to-Impact Reports');
  const fonts = await embedFonts(doc);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, page, fonts, y: PAGE_H - MARGIN, locale };
  drawHeader(ctx, bundle);
  drawKpis(ctx, bundle);
  for (const s of bundle.sections) drawSection(ctx, s);
  drawFooter(ctx, bundle);
  return doc.save();
}
