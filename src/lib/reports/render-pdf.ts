// Generic PDF renderer for any ReportBundle — Round 6 redesign.
//
// Aesthetic: Esteraha-inspired editorial layout mapped onto the I2I brand
// tokens (dark navy #0F2D36 structural surfaces, gold #E0A82E as the single
// accent, cream #F7F5EF content background). Typography is Frutiger LT Arabic
// across all four weights (Light 45 / Roman 55 / Bold 65 / Black 75) embedded
// for both Latin and Arabic scripts, so AR and EN ship identically.
//
// Built on pdf-lib + fontkit (programmatic drawing — no HTML/CSS engine). Every
// draw call flows through the direction-aware primitives so a single `rtl` flag
// mirrors the whole layout: gold rules on the leading edge, page numbers on the
// trailing edge, tables flipped. Numbers and dates always use Latin digits.
//
// Page flow: cover (navy) → content pages (cream: KPIs + sections) → back cover.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportBundle } from './types';
import { REPORT_META } from './types';

// A4 portrait (unchanged — do not alter page size).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48; // outer content margin
const BODY_TOP = PAGE_H - 82; // below the content-page header band
const BODY_BOTTOM = 66; // leave room for the footer

// I2I brand palette (from tailwind.config.ts — hex values must not change).
function hex(h: string) {
  const n = h.replace('#', '');
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255
  );
}
const TEAL_DARK = hex('#0F2D36'); // covers, headers, table header, dark bands
const TEAL = hex('#1C4854'); // secondary dark surface
const GOLD = hex('#E0A82E'); // the single accent
const GOLD_LIGHT = hex('#F5EDD6'); // soft gold fill / progress track
const CREAM = hex('#F7F5EF'); // content background
const WHITE = rgb(1, 1, 1);
const INK = hex('#232529'); // body text
const MUTED = hex('#5B6470'); // muted text (derived)
const DIVIDER = hex('#D8D4C7'); // subtle cream-shift divider (derived)
const CREAM_ON_DARK = hex('#EDE7D8'); // cream text legible on navy

const FONT_DIR = path.join(process.cwd(), 'src/lib/reports/assets/fonts');

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

// Frutiger weights. `black` (75) is reserved for hero titles and giant KPI
// numbers; `bold` (65) for headings and labels; `reg` (55) for body; `light`
// (45) for muted small text.
type Fonts = { light: PDFFont; reg: PDFFont; bold: PDFFont; black: PDFFont };

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const load = async (file: string, fallback: StandardFonts) => {
    const bytes = readFontSafe(path.join(FONT_DIR, file));
    return bytes ? doc.embedFont(bytes, { subset: true }) : doc.embedFont(fallback);
  };
  // Frutiger LT Arabic supports Latin adequately, so one family serves both
  // scripts. Standard-font fallbacks only fire if a weight file is missing.
  const light = await load('frutiger-arabic-light.ttf', StandardFonts.Helvetica);
  const reg = await load('frutiger-arabic-regular.ttf', StandardFonts.Helvetica);
  const bold = await load('frutiger-arabic-bold.ttf', StandardFonts.HelveticaBold);
  const black = await load('frutiger-arabic-black.ttf', StandardFonts.HelveticaBold);
  return { light, reg, bold, black };
}

const HAS_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// pdf-lib has no bidi engine: fontkit shapes Arabic correctly but reverses the
// internal order of Latin digit runs embedded in an Arabic string ("01"→"10",
// "2026"→"6202"). Pre-reversing each numeric run cancels that reversal so dates
// and section numbers read with correct Latin digits. No-op for pure-Latin text
// and width-neutral (same glyphs), so it is safe inside the draw primitives.
function bidiNums(s: string): string {
  if (!HAS_ARABIC.test(s)) return s;
  return s.replace(/[0-9][0-9:/.,\-]*/g, (m) => [...m].reverse().join(''));
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = '…';
  const el = (s: string) => {
    try {
      return font.widthOfTextAtSize(s, size);
    } catch {
      return Infinity;
    }
  };
  // Frutiger embeds the real ellipsis; the standard-font fallback does not, so
  // degrade to ASCII dots if the glyph is unavailable.
  const dots = el(ellipsis) === Infinity ? '...' : ellipsis;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const cand = text.slice(0, mid) + dots;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + dots;
}

// Largest size <= `max` at which `text` fits `maxWidth` (down to `min`). Used
// for KPI numbers so long values like "SAR 4.2M" shrink instead of truncating.
function fitSize(text: string, font: PDFFont, max: number, maxWidth: number, min = 14): number {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

// Naive word-wrap returning at most maxLines lines; the final line ellipsises.
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    lines[lines.length - 1] = fitText(lines[lines.length - 1], font, size, maxWidth);
  }
  return lines;
}

// ── Direction-aware primitives ──────────────────────────────────────────────
// `x` is the leading edge of an element (left in LTR, mirrored to the right in
// RTL). Passing w mirrors an element of that width; w=0 mirrors a point.
function mirrorX(rtl: boolean, x: number, w = 0): number {
  return rtl ? PAGE_W - x - w : x;
}

function pText(
  page: PDFPage,
  rtl: boolean,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  align: 'start' | 'end' = 'start'
) {
  if (!text) return;
  text = bidiNums(text);
  const w = font.widthOfTextAtSize(text, size);
  const left = align === 'end' ? x - w : x;
  page.drawText(text, { x: mirrorX(rtl, left, w), y, size, font, color });
}

// Letter-spaced label (small-caps look). Latin only — Arabic shaping breaks
// under tracking, so Arabic labels fall back to a plain run.
function pLabel(
  page: PDFPage,
  rtl: boolean,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  tracking: number,
  align: 'start' | 'end' = 'start'
) {
  if (!text) return;
  if (HAS_ARABIC.test(text) || tracking <= 0) {
    pText(page, rtl, text, x, y, font, size, color, align);
    return;
  }
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += font.widthOfTextAtSize(ch, size) + tracking;
  total -= tracking;
  const left = align === 'end' ? x - total : x;
  let cx = mirrorX(rtl, left, total);
  for (const ch of chars) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function pRect(
  page: PDFPage,
  rtl: boolean,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
  }
) {
  page.drawRectangle({ ...opts, x: mirrorX(rtl, opts.x, opts.width) });
}

function pLine(
  page: PDFPage,
  rtl: boolean,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: ReturnType<typeof rgb>
) {
  page.drawLine({
    start: { x: mirrorX(rtl, x1), y: y1 },
    end: { x: mirrorX(rtl, x2), y: y2 },
    thickness,
    color,
  });
}

// ── Localised chrome strings (bilingual inline — this renderer does not use
// next-intl; every string carries both AR and EN so neither locale is short).
type L = 'ar' | 'en';
const t = {
  brand: (l: L) => (l === 'ar' ? 'الابتكار إلى أثر' : 'INNOVATION TO IMPACT'),
  program: (l: L) => (l === 'ar' ? 'برنامج الابتكار التنافسي' : 'COMPETITION INNOVATION PROGRAM'),
  kpis: (l: L) => (l === 'ar' ? 'المؤشرات الرئيسية' : 'KEY INDICATORS'),
  section: (l: L) => (l === 'ar' ? 'القسم' : 'SECTION'),
  records: (l: L, n: number) => (l === 'ar' ? `${n} سجل` : `${n} records`),
  empty: (l: L) => (l === 'ar' ? 'لا توجد سجلات ضمن النطاق المحدد.' : 'No records within the selected range.'),
  period: (l: L) => (l === 'ar' ? 'الفترة' : 'PERIOD'),
  allPeriods: (l: L) => (l === 'ar' ? 'جميع الفترات' : 'All periods'),
  preparedBy: (l: L) => (l === 'ar' ? 'إعداد' : 'PREPARED BY'),
  systemAdmin: (l: L) => (l === 'ar' ? 'إدارة النظام' : 'System Administration'),
  issuedOn: (l: L) => (l === 'ar' ? 'تاريخ الإصدار' : 'ISSUED'),
  page: (l: L, n: number, total: number) => (l === 'ar' ? `${n} / ${total}` : `${n} / ${total}`),
  thanks: (l: L) => (l === 'ar' ? 'شكراً لكم' : 'THANK YOU'),
  backLine: (l: L) =>
    l === 'ar'
      ? 'منصة الابتكار إلى أثر · برنامج الابتكار التنافسي'
      : 'Innovation to Impact Platform · Competition Innovation Program',
};

function formatDate(iso: string, locale: L): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }
  ).format(d);
  return locale === 'ar' ? `${s} ميلادي` : s;
}

function formatDateTime(iso: string, locale: L): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
  ).format(d);
  return locale === 'ar' ? `${s} ميلادي` : `${s}`;
}

function reportId(bundle: ReportBundle): string {
  return `I2I-${bundle.type.toUpperCase()}-${bundle.generatedAt.slice(0, 10)}`;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  y: number;
  locale: L;
  rtl: boolean;
};

function newContentPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  paintContentChrome(ctx);
  ctx.y = BODY_TOP;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < BODY_BOTTOM) newContentPage(ctx);
}

// ── Cover page (full-bleed navy) ─────────────────────────────────────────────
function drawCover(ctx: Ctx, bundle: ReportBundle) {
  const { page, rtl, fonts, locale } = ctx;
  const meta = REPORT_META[bundle.type];
  const title = locale === 'ar' ? meta.name_ar : meta.name_en;
  const subtitle = locale === 'ar' ? meta.desc_ar : meta.desc_en;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: TEAL_DARK });
  // Top gold bar (full width).
  page.drawRectangle({ x: 0, y: PAGE_H - 10, width: PAGE_W, height: 10, color: GOLD });

  // Top row: program wordmark (leading), report ref (trailing).
  pLabel(page, rtl, t.program(locale), MARGIN, PAGE_H - 46, fonts.bold, 8.5, GOLD, 2.2, 'start');
  pLabel(page, rtl, reportId(bundle), PAGE_W - MARGIN, PAGE_H - 46, fonts.light, 8.5, CREAM_ON_DARK, 1.2, 'end');

  // Brand small-caps label above the hero title.
  const brandY = PAGE_H - 360;
  pLabel(page, rtl, t.brand(locale), MARGIN, brandY, fonts.bold, 11, GOLD, locale === 'ar' ? 0 : 4, 'start');

  // Hero title (Black 75), up to two lines, white.
  const titleSize = 44;
  const titleLines = wrap(title, fonts.black, titleSize, PAGE_W - MARGIN * 2, 3);
  let ty = brandY - 44;
  for (const line of titleLines) {
    pText(page, rtl, line, MARGIN, ty, fonts.black, titleSize, WHITE);
    ty -= titleSize * 1.05;
  }

  // Cream subtitle (Roman 55), wraps around ~60ch.
  const subLines = wrap(subtitle, fonts.reg, 15, Math.min(PAGE_W - MARGIN * 2, 430), 4);
  let sy = ty - 6;
  for (const line of subLines) {
    pText(page, rtl, line, MARGIN, sy, fonts.reg, 15, CREAM_ON_DARK);
    sy -= 22;
  }

  // Short gold rule between subtitle and metadata.
  const ruleY = sy - 20;
  pRect(page, rtl, { x: MARGIN, y: ruleY, width: 64, height: 2, color: GOLD });

  // Metadata line (small-caps gold): report id · date · locale. Rendered as
  // discrete runs so the Latin report id / date keep their digit order in RTL.
  // Locale token uses in-script text ("عربي") so no Latin run gets embedded in
  // the Arabic meta string (Latin letter runs also reverse under the engine).
  const localeLabel = locale === 'ar' ? 'عربي' : 'EN';
  pLabel(page, rtl, reportId(bundle), MARGIN, ruleY - 24, fonts.light, 9.5, GOLD, 1, 'start');
  const metaTail = `${formatDate(bundle.generatedAt, locale)}   ·   ${localeLabel}`;
  pLabel(page, rtl, metaTail, PAGE_W - MARGIN, ruleY - 24, fonts.light, 9.5, GOLD, 1, 'end');
}

// ── Content-page chrome: cream background, top header band, footer divider ───
function paintContentChrome(ctx: Ctx) {
  const { page, rtl } = ctx;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  // Header: short gold rule + section chrome is drawn per page in the footer
  // pass (it needs the running section label). Here we lay the static bits.
  pRect(page, rtl, { x: MARGIN, y: PAGE_H - 48, width: 40, height: 2, color: GOLD });
}

// ── KPI band (white cards, gold top rule, giant navy numbers) ────────────────
function drawKpis(ctx: Ctx, bundle: ReportBundle) {
  if (!bundle.kpis.length) return;
  const { rtl, fonts, locale } = ctx;

  drawBlockHeading(ctx, `${t.section(locale)} 01`, t.kpis(locale));

  const gap = 12;
  const perRow = 3;
  const cardW = (PAGE_W - MARGIN * 2 - gap * (perRow - 1)) / perRow;
  const cardH = 84;
  const kpis = bundle.kpis.slice(0, 6);
  const rows = Math.ceil(kpis.length / perRow);
  ensureSpace(ctx, rows * (cardH + gap) + 6);

  const startY = ctx.y - cardH;
  kpis.forEach((kpi, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = MARGIN + col * (cardW + gap);
    const y = startY - row * (cardH + gap);
    pRect(ctx.page, rtl, { x, y, width: cardW, height: cardH, color: WHITE });
    // Gold top rule flush with the card top edge.
    pRect(ctx.page, rtl, { x, y: y + cardH - 3, width: cardW, height: 3, color: GOLD });
    const label = locale === 'ar' ? kpi.label_ar : kpi.label_en;
    // Giant number (Black 75), navy — shrinks to fit rather than truncating.
    const valSize = fitSize(kpi.value, fonts.black, 34, cardW - 28, 16);
    pText(ctx.page, rtl, kpi.value, x + 14, y + 32, fonts.black, valSize, TEAL_DARK);
    // Muted label below.
    pText(ctx.page, rtl, fitText(label, fonts.light, 9.5, cardW - 24), x + 14, y + 14, fonts.light, 9.5, MUTED);
  });
  ctx.y = startY - (rows - 1) * (cardH + gap) - 26;
}

// Section/block heading: gold rule + small-caps kicker, then a bold heading.
function drawBlockHeading(ctx: Ctx, kicker: string, heading: string) {
  const { rtl, fonts } = ctx;
  ensureSpace(ctx, 46);
  pRect(ctx.page, rtl, { x: MARGIN, y: ctx.y - 4, width: 40, height: 2, color: GOLD });
  pLabel(ctx.page, rtl, kicker, MARGIN + 48, ctx.y - 8, fonts.bold, 9, GOLD, rtl ? 0 : 2, 'start');
  ctx.y -= 22;
  pText(ctx.page, rtl, fitText(heading, fonts.bold, 20, PAGE_W - MARGIN * 2), MARGIN, ctx.y - 16, fonts.bold, 20, INK);
  ctx.y -= 30;
}

// ── Section (heading + table) ────────────────────────────────────────────────
function drawSection(ctx: Ctx, section: ReportBundle['sections'][number], index: number) {
  const { rtl, fonts, locale } = ctx;
  const title = locale === 'ar' ? section.title_ar : section.title_en;
  const nn = String(index + 2).padStart(2, '0'); // 01 is the KPI band
  ensureSpace(ctx, 70);
  drawBlockHeading(ctx, `${t.section(locale)} ${nn}`, title);

  // Records chip on the trailing edge, aligned with the heading row.
  const chip = t.records(locale, section.rows.length);
  pText(ctx.page, rtl, chip, PAGE_W - MARGIN, ctx.y + 18, fonts.light, 9, MUTED, 'end');

  const availW = PAGE_W - MARGIN * 2;
  const totalWeight = section.columns.reduce((a, c) => a + (c.width ?? 20), 0);
  const colW = section.columns.map((c) => ((c.width ?? 20) / totalWeight) * availW);
  // 3+ columns: emphasise the middle (numerically important) column in gold.
  const emphCol = section.columns.length >= 3 ? Math.floor(section.columns.length / 2) : -1;

  const headerH = 22;
  const rowH = 18;

  const drawTableHeader = () => {
    pRect(ctx.page, rtl, { x: MARGIN, y: ctx.y - headerH, width: availW, height: headerH, color: TEAL_DARK });
    let cx = MARGIN;
    for (let i = 0; i < section.columns.length; i++) {
      const c = section.columns[i];
      const label = locale === 'ar' ? c.label_ar : c.label_en;
      pLabel(
        ctx.page,
        rtl,
        fitText(label, fonts.bold, 8.5, colW[i] - 12),
        cx + 8,
        ctx.y - 15,
        fonts.bold,
        8.5,
        GOLD,
        rtl ? 0 : 0.8,
        'start'
      );
      cx += colW[i];
    }
    ctx.y -= headerH;
  };

  ensureSpace(ctx, headerH + rowH);
  drawTableHeader();

  if (!section.rows.length) {
    pRect(ctx.page, rtl, { x: MARGIN, y: ctx.y - 26, width: availW, height: 26, color: WHITE });
    pText(ctx.page, rtl, t.empty(locale), MARGIN + 12, ctx.y - 17, fonts.reg, 9.5, MUTED);
    ctx.y -= 26;
    pLine(ctx.page, rtl, MARGIN, ctx.y, MARGIN + availW, ctx.y, 1, GOLD);
    ctx.y -= 26;
    return;
  }

  for (let ri = 0; ri < section.rows.length; ri++) {
    if (ctx.y - rowH < BODY_BOTTOM) {
      newContentPage(ctx);
      ensureSpace(ctx, headerH + rowH);
      drawTableHeader();
    }
    const row = section.rows[ri];
    // Alternating fill: white / cream.
    pRect(ctx.page, rtl, {
      x: MARGIN,
      y: ctx.y - rowH,
      width: availW,
      height: rowH,
      color: ri % 2 === 0 ? WHITE : CREAM,
    });
    let cx = MARGIN;
    for (let i = 0; i < section.columns.length; i++) {
      const c = section.columns[i];
      const raw = row[c.key];
      const text = raw === null || raw === undefined ? '' : String(raw);
      const isEmph = i === emphCol;
      pText(
        ctx.page,
        rtl,
        fitText(text, isEmph ? fonts.bold : fonts.reg, 8.5, colW[i] - 12),
        cx + 8,
        ctx.y - 12,
        isEmph ? fonts.bold : fonts.reg,
        8.5,
        isEmph ? GOLD : INK
      );
      cx += colW[i];
    }
    ctx.y -= rowH;
  }
  // Hairline gold bottom rule.
  pLine(ctx.page, rtl, MARGIN, ctx.y, MARGIN + availW, ctx.y, 1, GOLD);
  ctx.y -= 30;
}

// ── Back cover (navy, wordmarks, bottom gold bar) ────────────────────────────
function drawBackCover(ctx: Ctx) {
  const { rtl, fonts, locale } = ctx;
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: TEAL_DARK });
  // Bottom gold bar mirroring the cover's top bar.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 10, color: GOLD });

  const cx = PAGE_W / 2;
  // Thank-you kicker.
  const thanks = t.thanks(locale);
  const tw = fonts.black.widthOfTextAtSize(thanks, 40);
  page.drawText(thanks, { x: cx - tw / 2, y: PAGE_H / 2 + 40, size: 40, font: fonts.black, color: WHITE });
  // Short centred gold rule.
  page.drawRectangle({ x: cx - 32, y: PAGE_H / 2 + 20, width: 64, height: 2, color: GOLD });
  // Program wordmarks, generously spaced, centred.
  const brand = t.brand(locale);
  const bw = fonts.bold.widthOfTextAtSize(brand, 13);
  page.drawText(brand, { x: cx - bw / 2, y: PAGE_H / 2 - 14, size: 13, font: fonts.bold, color: GOLD });
  const prog = t.program(locale);
  const pw = fonts.light.widthOfTextAtSize(prog, 10);
  page.drawText(prog, { x: cx - pw / 2, y: PAGE_H / 2 - 40, size: 10, font: fonts.light, color: CREAM_ON_DARK });
  // Contact / platform line near the bottom.
  const line = t.backLine(locale);
  const lw = fonts.light.widthOfTextAtSize(line, 10);
  page.drawText(line, { x: cx - lw / 2, y: 60, size: 10, font: fonts.light, color: CREAM_ON_DARK });

  // Suppress unused-var lint for rtl (back cover is centred, direction-neutral).
  void rtl;
}

// ── Footer + running header on every content page ────────────────────────────
function drawContentFooters(
  ctx: Ctx,
  bundle: ReportBundle,
  contentPageIndices: number[]
) {
  const { rtl, fonts, locale } = ctx;
  const total = contentPageIndices.length;
  const meta = REPORT_META[bundle.type];
  const sectionLabel = locale === 'ar' ? meta.name_ar : meta.name_en;
  const rid = reportId(bundle);

  contentPageIndices.forEach((pageIndex, i) => {
    const p = ctx.doc.getPage(pageIndex);
    const n = i + 1;

    // Running header: small-caps section label (gold) next to the gold rule
    // that paintContentChrome already drew, report id on the trailing edge.
    pLabel(
      p,
      rtl,
      fitText(sectionLabel, fonts.bold, 9, PAGE_W / 2),
      MARGIN + 48,
      PAGE_H - 51,
      fonts.bold,
      9,
      GOLD,
      rtl ? 0 : 1.5,
      'start'
    );
    pLabel(p, rtl, rid, PAGE_W - MARGIN, PAGE_H - 51, fonts.light, 8, MUTED, 0.8, 'end');

    // Footer hairline divider.
    pLine(p, rtl, MARGIN, 48, PAGE_W - MARGIN, 48, 0.6, DIVIDER);
    // Leading: brand wordmark small-caps.
    pLabel(p, rtl, t.brand(locale), MARGIN, 33, fonts.bold, 8, TEAL, rtl ? 0 : 1.5, 'start');
    // Center: generation timestamp.
    const stamp = bidiNums(formatDateTime(bundle.generatedAt, locale));
    const cw = fonts.light.widthOfTextAtSize(stamp, 8);
    p.drawText(stamp, { x: (PAGE_W - cw) / 2, y: 33, size: 8, font: fonts.light, color: MUTED });
    // Trailing: page / total (tabular, Latin digits).
    pLabel(p, rtl, t.page(locale, n, total), PAGE_W - MARGIN, 33, fonts.bold, 9, TEAL, 0.5, 'end');
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────
export async function renderPdf(bundle: ReportBundle, locale: L = 'en'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const meta = REPORT_META[bundle.type];
  doc.setTitle(`${meta.name_en} — Innovation to Impact`);
  doc.setAuthor('Innovation to Impact Platform');
  doc.setSubject(locale === 'ar' ? meta.name_ar : meta.name_en);
  doc.setKeywords(['Innovation to Impact', 'Competition Innovation Program', bundle.type]);
  doc.setCreator('Innovation to Impact Reports');
  doc.setProducer('Innovation to Impact Platform');

  const fonts = await embedFonts(doc);
  const rtl = locale === 'ar';

  // Cover.
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, page: cover, fonts, y: BODY_TOP, locale, rtl };
  drawCover(ctx, bundle);

  // First content page.
  newContentPage(ctx);
  const firstContentIndex = doc.getPageIndices().length - 1;

  drawKpis(ctx, bundle);
  for (let i = 0; i < bundle.sections.length; i++) {
    drawSection(ctx, bundle.sections[i], i);
  }

  const afterContentIndex = doc.getPageIndices().length - 1;
  const contentPageIndices: number[] = [];
  for (let i = firstContentIndex; i <= afterContentIndex; i++) contentPageIndices.push(i);

  drawContentFooters(ctx, bundle, contentPageIndices);
  drawBackCover(ctx);

  return doc.save();
}
