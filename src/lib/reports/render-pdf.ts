// Generic PDF renderer for any ReportBundle — Round 7 (brand-guideline rebuild).
//
// Palette (Competition Innovation Program Style Guide p.8 — the ONLY palette):
//   MOON RAKER  #1C4854  the single strong color — cover/back bg, section
//                        dividers, table header, big KPI numbers, footer accent
//   SWANS DOWN  #D8EFE5  soft accent tint — cover top bar, KPI/section rules,
//                        section labels, cover subtitle/meta on the dark bg
//   HUMMING BIRD #CFEDF8 support tint — alternating table rows, hairlines
//   SHARK       #232529  body text
//   WHITE       #FFFFFF  content-page background + card surfaces
// No gold, no cream, no #0F2D36 anywhere.
//
// Typography (Style Guide p.10) — chosen per report locale:
//   English (Latin): Inter (free, Helvetica-metric-compatible substitute for the
//     proprietary Helvetica Now). Weights: Regular / Medium / SemiBold / Bold at
//     src/lib/reports/assets/fonts/inter-*.ttf.
//   Arabic: Frutiger LT Arabic (Light 45 / Roman 55 / Bold 65 / Black 75) at
//     src/lib/reports/assets/fonts/frutiger-arabic-*.ttf (kept from Round 6).
//
// Logo: the real brand mark is embedded as PNG. pdf-lib cannot rasterize SVG, so
// public/brand/*.svg was pre-rendered (cairosvg, 3× print size) to PNGs at
// src/lib/reports/assets/logos/{logo-colored,logo-white}.png and committed. The
// PNGs are embedded once per document and reused across every page.
//
// Every brand/chrome string flows through messages/{en,ar}.json (brand.* and
// reports.*) — no hardcoded program name or chrome text lives in this file.
//
// Built on pdf-lib + fontkit (programmatic drawing — no HTML/CSS engine). Every
// draw call flows through direction-aware primitives so a single `rtl` flag
// mirrors the layout. Numbers and dates always use Latin digits.
//
// Page flow: cover (Moon Raker) → content pages (white) → back cover (Moon Raker).
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportBundle } from './types';
import { REPORT_META } from './types';
import enMessages from '../../../messages/en.json';
import arMessages from '../../../messages/ar.json';

// A4 portrait (unchanged — do not alter page size).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48; // outer content margin
const BODY_TOP = PAGE_H - 82; // below the content-page header band
const BODY_BOTTOM = 66; // leave room for the footer

// Guideline palette — hex must match tailwind.config.ts brand tokens.
function hex(h: string) {
  const n = h.replace('#', '');
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255
  );
}
const MOON_RAKER = hex('#1C4854'); // the one strong color
const SWANS_DOWN = hex('#D8EFE5'); // soft accent tint
const HUMMING_BIRD = hex('#CFEDF8'); // support tint
const SHARK = hex('#232529'); // body text
const WHITE = rgb(1, 1, 1);
const GRAY = hex('#5C5F66'); // muted body / secondary text

const FONT_DIR = path.join(process.cwd(), 'src/lib/reports/assets/fonts');
const LOGO_DIR = path.join(process.cwd(), 'src/lib/reports/assets/logos');

function readFileSafe(...tryPaths: string[]): Uint8Array | null {
  for (const p of tryPaths) {
    try {
      return fs.readFileSync(p);
    } catch {
      // continue
    }
  }
  return null;
}

// Five semantic roles used by the draw code, resolved to a real weight per script.
// `black` → hero titles + giant KPI numbers; `bold` → headings/labels; `medium`
// → footer/meta chrome; `reg` → body; `light` → muted small text.
type Fonts = { light: PDFFont; reg: PDFFont; medium: PDFFont; bold: PDFFont; black: PDFFont };

async function embedFonts(doc: PDFDocument, locale: L): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const load = async (file: string, fallback: StandardFonts) => {
    const bytes = readFileSafe(path.join(FONT_DIR, file));
    return bytes ? doc.embedFont(bytes, { subset: true }) : doc.embedFont(fallback);
  };

  if (locale === 'ar') {
    // Frutiger LT Arabic — one family, four weights; also covers Latin digits.
    const light = await load('frutiger-arabic-light.ttf', StandardFonts.Helvetica);
    const reg = await load('frutiger-arabic-regular.ttf', StandardFonts.Helvetica);
    const bold = await load('frutiger-arabic-bold.ttf', StandardFonts.HelveticaBold);
    const black = await load('frutiger-arabic-black.ttf', StandardFonts.HelveticaBold);
    // Frutiger has no Medium; Bold (65) is the closest editorial mid-weight.
    return { light, reg, medium: bold, bold, black };
  }

  // English (Latin) — Inter, four registered weights.
  const regular = await load('inter-regular.ttf', StandardFonts.Helvetica);
  const medium = await load('inter-medium.ttf', StandardFonts.Helvetica);
  const semibold = await load('inter-semibold.ttf', StandardFonts.HelveticaBold);
  const bold = await load('inter-bold.ttf', StandardFonts.HelveticaBold);
  // Inter has no Light; Regular is the lightest shipped weight.
  return { light: regular, reg: regular, medium, bold: semibold, black: bold };
}

// Logo rasters embedded once and reused across pages.
type Logos = { colored: PDFImage | null; white: PDFImage | null };

async function embedLogos(doc: PDFDocument): Promise<Logos> {
  const readImg = async (file: string) => {
    const bytes = readFileSafe(path.join(LOGO_DIR, file));
    return bytes ? doc.embedPng(bytes) : null;
  };
  return { colored: await readImg('logo-colored.png'), white: await readImg('logo-white.png') };
}

// Draw a logo scaled to a target height, with its leading edge at `x` (mirrored
// in RTL). Returns the rendered width so callers can lay out around it.
function drawLogo(
  page: PDFPage,
  rtl: boolean,
  img: PDFImage | null,
  x: number,
  y: number,
  targetH: number
): number {
  if (!img) return 0;
  const scale = targetH / img.height;
  const w = img.width * scale;
  page.drawImage(img, { x: mirrorX(rtl, x, w), y, width: w, height: targetH });
  return w;
}

const HAS_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// pdf-lib has no bidi engine: fontkit shapes Arabic correctly but reverses the
// internal order of Latin digit runs embedded in an Arabic string ("01"→"10").
// Pre-reversing each numeric run cancels that so dates/section numbers read
// correctly. No-op for pure-Latin text and width-neutral, so safe everywhere.
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

// Largest size <= `max` at which `text` fits `maxWidth` (down to `min`).
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

// ── Localised strings — single source of truth is messages/{en,ar}.json ──────
type L = 'ar' | 'en';
const MESSAGES: Record<L, typeof enMessages> = { en: enMessages, ar: arMessages };

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// Pull every brand/chrome string from messages so a single edit propagates to
// every report and the web UI. No literal program/chrome text lives below.
function strings(locale: L) {
  const m = MESSAGES[locale];
  const b = m.brand;
  const r = m.reports;
  const brandLabel = locale === 'ar' ? b.platformName : b.platformName.toUpperCase();
  const programLabel = locale === 'ar' ? b.programName : b.programName.toUpperCase();
  return {
    platform: b.platformName,
    program: b.programName,
    brandLabel,
    programLabel,
    kpis: locale === 'ar' ? r.keyIndicators : r.keyIndicators.toUpperCase(),
    section: locale === 'ar' ? r.section : r.section.toUpperCase(),
    records: (n: number) => fmt(r.records, { count: n }),
    empty: r.empty,
    thanks: locale === 'ar' ? r.thankYou : r.thankYou.toUpperCase(),
    page: (n: number, total: number) => fmt(r.pageOf, { page: n, total }),
    localeLabel: r.localeLabel,
    backLine: fmt(r.backLine, { platform: b.platformName, program: b.programName }),
  };
}

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
  logos: Logos;
  s: ReturnType<typeof strings>;
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

// ── Cover page (full-bleed Moon Raker) ───────────────────────────────────────
function drawCover(ctx: Ctx, bundle: ReportBundle) {
  const { page, rtl, fonts, locale, logos, s } = ctx;
  const meta = REPORT_META[bundle.type];
  const title = locale === 'ar' ? meta.name_ar : meta.name_en;
  const subtitle = locale === 'ar' ? meta.desc_ar : meta.desc_en;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: MOON_RAKER });
  // Thin Swans Down top bar (full width).
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: SWANS_DOWN });

  // White logo in the top-leading corner (top-right in AR, top-left in EN).
  drawLogo(page, rtl, logos.white, MARGIN, PAGE_H - 74, 28);

  // Program wordmark label (leading) + report ref (trailing), below the logo.
  pLabel(page, rtl, s.programLabel, MARGIN, PAGE_H - 96, fonts.bold, 8.5, SWANS_DOWN, 2.2, 'start');
  pLabel(page, rtl, reportId(bundle), PAGE_W - MARGIN, PAGE_H - 96, fonts.light, 8.5, SWANS_DOWN, 1.2, 'end');

  // Brand small-caps label above the hero title.
  const brandY = PAGE_H - 360;
  pLabel(page, rtl, s.brandLabel, MARGIN, brandY, fonts.bold, 11, SWANS_DOWN, locale === 'ar' ? 0 : 4, 'start');

  // Hero title (black weight), up to three lines, white.
  const titleSize = 44;
  const titleLines = wrap(title, fonts.black, titleSize, PAGE_W - MARGIN * 2, 3);
  let ty = brandY - 44;
  for (const line of titleLines) {
    pText(page, rtl, line, MARGIN, ty, fonts.black, titleSize, WHITE);
    ty -= titleSize * 1.05;
  }

  // Subtitle (Swans Down), wraps around ~430pt.
  const subLines = wrap(subtitle, fonts.reg, 15, Math.min(PAGE_W - MARGIN * 2, 430), 4);
  let sy = ty - 6;
  for (const line of subLines) {
    pText(page, rtl, line, MARGIN, sy, fonts.reg, 15, SWANS_DOWN);
    sy -= 22;
  }

  // Short Swans Down rule between subtitle and metadata.
  const ruleY = sy - 20;
  pRect(page, rtl, { x: MARGIN, y: ruleY, width: 64, height: 2, color: SWANS_DOWN });

  // Metadata line: report id (leading), date · locale (trailing) — Swans Down.
  pLabel(page, rtl, reportId(bundle), MARGIN, ruleY - 24, fonts.light, 9.5, SWANS_DOWN, 1, 'start');
  const metaTail = `${formatDate(bundle.generatedAt, locale)}   ·   ${s.localeLabel}`;
  pLabel(page, rtl, metaTail, PAGE_W - MARGIN, ruleY - 24, fonts.light, 9.5, SWANS_DOWN, 1, 'end');
}

// ── Content-page chrome: white background + a short Swans Down header rule ────
function paintContentChrome(ctx: Ctx) {
  const { page, rtl } = ctx;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
  pRect(page, rtl, { x: MARGIN, y: PAGE_H - 48, width: 40, height: 2, color: SWANS_DOWN });
}

// ── KPI band (white cards, Swans Down top rule, giant Moon Raker numbers) ─────
function drawKpis(ctx: Ctx, bundle: ReportBundle) {
  if (!bundle.kpis.length) return;
  const { rtl, fonts, locale, s } = ctx;

  drawBlockHeading(ctx, `${s.section} 01`, s.kpis);

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
    // White card with a subtle Humming Bird hairline border.
    pRect(ctx.page, rtl, { x, y, width: cardW, height: cardH, color: WHITE, borderColor: HUMMING_BIRD, borderWidth: 0.75 });
    // Swans Down 2pt top rule flush with the card top edge.
    pRect(ctx.page, rtl, { x, y: y + cardH - 2, width: cardW, height: 2, color: SWANS_DOWN });
    const label = locale === 'ar' ? kpi.label_ar : kpi.label_en;
    // Giant number (black weight), Moon Raker — shrinks to fit rather than truncating.
    const valSize = fitSize(kpi.value, fonts.black, 34, cardW - 28, 16);
    pText(ctx.page, rtl, kpi.value, x + 14, y + 32, fonts.black, valSize, MOON_RAKER);
    // Muted label below.
    pText(ctx.page, rtl, fitText(label, fonts.light, 9.5, cardW - 24), x + 14, y + 14, fonts.light, 9.5, GRAY);
  });
  ctx.y = startY - (rows - 1) * (cardH + gap) - 26;
}

// Section/block heading: Swans Down rule + small-caps Moon Raker kicker, then a
// Shark heading.
function drawBlockHeading(ctx: Ctx, kicker: string, heading: string) {
  const { rtl, fonts } = ctx;
  ensureSpace(ctx, 46);
  pRect(ctx.page, rtl, { x: MARGIN, y: ctx.y - 4, width: 40, height: 2, color: SWANS_DOWN });
  pLabel(ctx.page, rtl, kicker, MARGIN + 48, ctx.y - 8, fonts.bold, 9, MOON_RAKER, rtl ? 0 : 2, 'start');
  ctx.y -= 22;
  pText(ctx.page, rtl, fitText(heading, fonts.bold, 20, PAGE_W - MARGIN * 2), MARGIN, ctx.y - 16, fonts.bold, 20, SHARK);
  ctx.y -= 30;
}

// ── Section (heading + table) ────────────────────────────────────────────────
function drawSection(ctx: Ctx, section: ReportBundle['sections'][number], index: number) {
  const { rtl, fonts, locale, s } = ctx;
  const title = locale === 'ar' ? section.title_ar : section.title_en;
  const nn = String(index + 2).padStart(2, '0'); // 01 is the KPI band
  ensureSpace(ctx, 70);
  drawBlockHeading(ctx, `${s.section} ${nn}`, title);

  // Records chip on the trailing edge, aligned with the heading row.
  const chip = s.records(section.rows.length);
  pText(ctx.page, rtl, chip, PAGE_W - MARGIN, ctx.y + 18, fonts.light, 9, GRAY, 'end');

  const availW = PAGE_W - MARGIN * 2;
  const totalWeight = section.columns.reduce((a, c) => a + (c.width ?? 20), 0);
  const colW = section.columns.map((c) => ((c.width ?? 20) / totalWeight) * availW);
  // 3+ columns: emphasise the middle (numerically important) column in Moon Raker.
  const emphCol = section.columns.length >= 3 ? Math.floor(section.columns.length / 2) : -1;

  const headerH = 22;
  const rowH = 18;

  const drawTableHeader = () => {
    pRect(ctx.page, rtl, { x: MARGIN, y: ctx.y - headerH, width: availW, height: headerH, color: MOON_RAKER });
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
        WHITE,
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
    pText(ctx.page, rtl, s.empty, MARGIN + 12, ctx.y - 17, fonts.reg, 9.5, GRAY);
    ctx.y -= 26;
    pLine(ctx.page, rtl, MARGIN, ctx.y, MARGIN + availW, ctx.y, 1, SWANS_DOWN);
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
    // Alternating fill: white / Humming Bird.
    pRect(ctx.page, rtl, {
      x: MARGIN,
      y: ctx.y - rowH,
      width: availW,
      height: rowH,
      color: ri % 2 === 0 ? WHITE : HUMMING_BIRD,
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
        isEmph ? MOON_RAKER : SHARK
      );
      cx += colW[i];
    }
    ctx.y -= rowH;
  }
  // Hairline Swans Down bottom rule.
  pLine(ctx.page, rtl, MARGIN, ctx.y, MARGIN + availW, ctx.y, 1, SWANS_DOWN);
  ctx.y -= 30;
}

// ── Back cover (Moon Raker, centred white logo, bottom Swans Down bar) ────────
function drawBackCover(ctx: Ctx) {
  const { rtl, fonts, logos, s } = ctx;
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: MOON_RAKER });
  // Bottom Swans Down bar mirroring the cover's top bar.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 8, color: SWANS_DOWN });

  const cx = PAGE_W / 2;
  // Thank-you kicker.
  const thanks = s.thanks;
  const tw = fonts.black.widthOfTextAtSize(thanks, 40);
  page.drawText(thanks, { x: cx - tw / 2, y: PAGE_H / 2 + 60, size: 40, font: fonts.black, color: WHITE });
  // Short centred Swans Down rule.
  page.drawRectangle({ x: cx - 32, y: PAGE_H / 2 + 40, width: 64, height: 2, color: SWANS_DOWN });

  // Centred white logo (includes the wordmark — no extra program text below).
  if (logos.white) {
    const targetH = 64;
    const scale = targetH / logos.white.height;
    const w = logos.white.width * scale;
    page.drawImage(logos.white, { x: cx - w / 2, y: PAGE_H / 2 - 40, width: w, height: targetH });
  }

  // Platform · program line near the bottom (dynamic — from messages).
  const line = s.backLine;
  const lw = fonts.light.widthOfTextAtSize(line, 10);
  page.drawText(line, { x: cx - lw / 2, y: 60, size: 10, font: fonts.light, color: SWANS_DOWN });

  void rtl; // back cover is centred / direction-neutral
}

// ── Footer + running header on every content page ────────────────────────────
function drawContentFooters(ctx: Ctx, bundle: ReportBundle, contentPageIndices: number[]) {
  const { rtl, fonts, locale, logos, s } = ctx;
  const total = contentPageIndices.length;
  const meta = REPORT_META[bundle.type];
  const sectionLabel = locale === 'ar' ? meta.name_ar : meta.name_en;
  const rid = reportId(bundle);

  contentPageIndices.forEach((pageIndex, i) => {
    const p = ctx.doc.getPage(pageIndex);
    const n = i + 1;

    // Running header: small-caps section label (Moon Raker) beside the Swans
    // Down rule paintContentChrome drew; report id on the trailing edge.
    pLabel(
      p,
      rtl,
      fitText(sectionLabel, fonts.bold, 9, PAGE_W / 2),
      MARGIN + 48,
      PAGE_H - 51,
      fonts.bold,
      9,
      MOON_RAKER,
      rtl ? 0 : 1.5,
      'start'
    );
    pLabel(p, rtl, rid, PAGE_W - MARGIN, PAGE_H - 51, fonts.light, 8, GRAY, 0.8, 'end');

    // Footer hairline divider (Humming Bird).
    pLine(p, rtl, MARGIN, 48, PAGE_W - MARGIN, 48, 0.5, HUMMING_BIRD);
    // Leading: colored logo in the bottom corner.
    const logoW = drawLogo(p, rtl, logos.colored, MARGIN, 30, 18);
    // Brand label small-caps, just inboard of the logo.
    pLabel(p, rtl, s.brandLabel, MARGIN + (logoW ? logoW + 10 : 0), 34, fonts.medium, 8, MOON_RAKER, rtl ? 0 : 1.5, 'start');
    // Center: generation timestamp.
    const stamp = bidiNums(formatDateTime(bundle.generatedAt, locale));
    const cw = fonts.light.widthOfTextAtSize(stamp, 8);
    p.drawText(stamp, { x: (PAGE_W - cw) / 2, y: 34, size: 8, font: fonts.light, color: GRAY });
    // Trailing: page / total (tabular, Latin digits) in Shark.
    pLabel(p, rtl, s.page(n, total), PAGE_W - MARGIN, 34, fonts.bold, 9, SHARK, 0.5, 'end');
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────
export async function renderPdf(bundle: ReportBundle, locale: L = 'en'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const meta = REPORT_META[bundle.type];
  const s = strings(locale);
  doc.setTitle(`${meta.name_en} — ${MESSAGES.en.brand.platformName}`);
  doc.setAuthor(`${MESSAGES.en.brand.platformName} Platform`);
  doc.setSubject(locale === 'ar' ? meta.name_ar : meta.name_en);
  doc.setKeywords([MESSAGES.en.brand.platformName, MESSAGES.en.brand.programName, bundle.type]);
  doc.setCreator(`${MESSAGES.en.brand.platformName} Reports`);
  doc.setProducer(`${MESSAGES.en.brand.platformName} Platform`);

  const fonts = await embedFonts(doc, locale);
  const logos = await embedLogos(doc);
  const rtl = locale === 'ar';

  // Cover.
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, page: cover, fonts, logos, s, y: BODY_TOP, locale, rtl };
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
