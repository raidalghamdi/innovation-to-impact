// Rich, chart-driven PDF renderer for the 18 screen reports. Produces:
//   • a full-bleed Moon Raker cover (title, subtitle, generated_at, filters)
//   • one section per chart — large charts full-width, small charts two-per-row
//   • an optional data table appendix (when the screen spec sets showTable)
//   • Arabic RTL mirroring throughout
//
// Branding (palette, fonts, logos, A4 geometry) mirrors the existing
// src/lib/reports/render-pdf.ts EXACTLY — the assets and constants are copied,
// not imported, so this new renderer never modifies the existing module.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { renderSpecChart } from '../charts/render-spec';
import type { ChartDatum, ScreenData } from '../data/live-queries';
import type { ScreenSpec } from '../screen-specs';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const BODY_TOP = PAGE_H - 82;
const BODY_BOTTOM = 66;

function hex(h: string) {
  const n = h.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
const MOON_RAKER = hex('#1C4854');
const SWANS_DOWN = hex('#D8EFE5');
const HUMMING_BIRD = hex('#CFEDF8');
const SHARK = hex('#232529');
const WHITE = rgb(1, 1, 1);
const GRAY = hex('#5C5F66');

const FONT_DIR = path.join(process.cwd(), 'src/lib/reports/assets/fonts');
const LOGO_DIR = path.join(process.cwd(), 'src/lib/reports/assets/logos');

function readFileSafe(...tryPaths: string[]): Uint8Array | null {
  for (const p of tryPaths) {
    try {
      return fs.readFileSync(p);
    } catch {
      /* continue */
    }
  }
  return null;
}

type L = 'ar' | 'en';
type Fonts = { light: PDFFont; reg: PDFFont; medium: PDFFont; bold: PDFFont; black: PDFFont };

async function embedFonts(doc: PDFDocument, locale: L): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const load = async (file: string, fallback: StandardFonts) => {
    const bytes = readFileSafe(path.join(FONT_DIR, file));
    return bytes ? doc.embedFont(bytes, { subset: true }) : doc.embedFont(fallback);
  };
  if (locale === 'ar') {
    const light = await load('frutiger-arabic-light.ttf', StandardFonts.Helvetica);
    const reg = await load('frutiger-arabic-regular.ttf', StandardFonts.Helvetica);
    const bold = await load('frutiger-arabic-bold.ttf', StandardFonts.HelveticaBold);
    const black = await load('frutiger-arabic-black.ttf', StandardFonts.HelveticaBold);
    return { light, reg, medium: bold, bold, black };
  }
  const regular = await load('inter-regular.ttf', StandardFonts.Helvetica);
  const medium = await load('inter-medium.ttf', StandardFonts.Helvetica);
  const semibold = await load('inter-semibold.ttf', StandardFonts.HelveticaBold);
  const bold = await load('inter-bold.ttf', StandardFonts.HelveticaBold);
  return { light: regular, reg: regular, medium, bold: semibold, black: bold };
}

async function embedLogos(doc: PDFDocument) {
  const readImg = async (file: string) => {
    const bytes = readFileSafe(path.join(LOGO_DIR, file));
    return bytes ? doc.embedPng(bytes) : null;
  };
  return { colored: await readImg('logo-colored.png'), white: await readImg('logo-white.png') };
}

const HAS_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function bidiNums(s: string): string {
  if (!HAS_ARABIC.test(s)) return s;
  return s.replace(/[0-9][0-9:/.,\-]*/g, (m) => [...m].reverse().join(''));
}

function mirrorX(rtl: boolean, x: number, w = 0): number {
  return rtl ? PAGE_W - x - w : x;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid) + '…', size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) lines[lines.length - 1] = fitText(lines[lines.length - 1], font, size, maxWidth);
  return lines;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  logos: { colored: PDFImage | null; white: PDFImage | null };
  y: number;
  locale: L;
  rtl: boolean;
};

function pText(
  ctx: Ctx,
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
  ctx.page.drawText(text, { x: mirrorX(ctx.rtl, left, w), y, size, font, color });
}

function pRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>, bw = 0) {
  ctx.page.drawRectangle({ x: mirrorX(ctx.rtl, x, w), y, width: w, height: h, color, borderColor: border, borderWidth: bw || undefined });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
  pRect(ctx, MARGIN, PAGE_H - 48, 40, 2, SWANS_DOWN);
  ctx.y = BODY_TOP;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < BODY_BOTTOM) newPage(ctx);
}

export type RichPdfInput = {
  screenId: string;
  spec: ScreenSpec;
  data: ScreenData;
  locale: L;
  title: string; // resolved, localized screen title
  subtitle?: string;
  generatedBy: string;
  generatedAt?: string; // ISO
  filters?: string; // human-readable filter summary
  chartTitles: Record<string, string>; // chartId → localized title
};

function fmtDateTime(iso: string, locale: L): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(d);
  return locale === 'ar' ? `${s} ميلادي` : s;
}

function drawCover(ctx: Ctx, input: RichPdfInput, generatedAt: string) {
  const { rtl, fonts } = ctx;
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: MOON_RAKER });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: SWANS_DOWN });
  if (ctx.logos.white) {
    const h = 28;
    const scale = h / ctx.logos.white.height;
    const w = ctx.logos.white.width * scale;
    ctx.page.drawImage(ctx.logos.white, { x: mirrorX(rtl, MARGIN, w), y: PAGE_H - 74, width: w, height: h });
  }
  const brandY = PAGE_H - 340;
  const titleLines = wrap(input.title, fonts.black, 40, PAGE_W - MARGIN * 2, 3);
  let ty = brandY;
  for (const line of titleLines) {
    pText(ctx, line, MARGIN, ty, fonts.black, 40, WHITE);
    ty -= 42;
  }
  if (input.subtitle) {
    const subLines = wrap(input.subtitle, fonts.reg, 14, Math.min(PAGE_W - MARGIN * 2, 430), 3);
    let sy = ty - 4;
    for (const line of subLines) {
      pText(ctx, line, MARGIN, sy, fonts.reg, 14, SWANS_DOWN);
      sy -= 20;
    }
    ty = sy;
  }
  pRect(ctx, MARGIN, ty - 16, 64, 2, SWANS_DOWN);
  let my = ty - 40;
  const metaLine = (label: string, value: string) => {
    pText(ctx, `${label}  ${value}`, MARGIN, my, fonts.light, 10, SWANS_DOWN);
    my -= 18;
  };
  metaLine(ctx.locale === 'ar' ? 'أُنشئ:' : 'Generated:', `${fmtDateTime(generatedAt, ctx.locale)}  ·  ${input.generatedBy}`);
  if (input.filters) metaLine(ctx.locale === 'ar' ? 'المرشّحات:' : 'Filters:', input.filters);
}

function drawChartTitle(ctx: Ctx, x: number, w: number, title: string) {
  const { fonts } = ctx;
  pRect(ctx, x, ctx.y - 3, 24, 2, SWANS_DOWN);
  pText(ctx, fitText(title, fonts.bold, 11, w), x, ctx.y - 15, fonts.bold, 11, MOON_RAKER);
  ctx.y -= 22;
}

// Embed a chart PNG scaled to fit a box; returns the drawn height.
function drawChartImage(ctx: Ctx, img: PDFImage, x: number, boxW: number): number {
  const h = boxW * (img.height / img.width);
  ctx.page.drawImage(img, { x: mirrorX(ctx.rtl, x, boxW), y: ctx.y - h, width: boxW, height: h });
  return h;
}

function categoricalTable(datum: ChartDatum | undefined): Array<[string, string]> | null {
  if (!datum || datum.kind !== 'categorical' || !datum.labels.length) return null;
  return datum.labels.slice(0, 15).map((l, i) => [l, String(datum.values[i] ?? 0)]);
}

function drawTable(ctx: Ctx, heading: string, rows: Array<[string, string]>, locale: L) {
  const { fonts } = ctx;
  const availW = PAGE_W - MARGIN * 2;
  ensure(ctx, 60);
  drawChartTitle(ctx, MARGIN, availW, heading);
  const headerH = 20;
  const rowH = 17;
  pRect(ctx, MARGIN, ctx.y - headerH, availW, headerH, MOON_RAKER);
  pText(ctx, locale === 'ar' ? 'الفئة' : 'Category', MARGIN + 8, ctx.y - 14, fonts.bold, 8.5, WHITE);
  pText(ctx, locale === 'ar' ? 'القيمة' : 'Value', MARGIN + availW - 8, ctx.y - 14, fonts.bold, 8.5, WHITE, 'end');
  ctx.y -= headerH;
  rows.forEach((r, i) => {
    if (ctx.y - rowH < BODY_BOTTOM) newPage(ctx);
    pRect(ctx, MARGIN, ctx.y - rowH, availW, rowH, i % 2 === 0 ? WHITE : HUMMING_BIRD);
    pText(ctx, fitText(r[0], fonts.reg, 8.5, availW - 80), MARGIN + 8, ctx.y - 12, fonts.reg, 8.5, SHARK);
    pText(ctx, r[1], MARGIN + availW - 8, ctx.y - 12, fonts.bold, 8.5, MOON_RAKER, 'end');
    ctx.y -= rowH;
  });
  ctx.y -= 18;
}

export async function renderRichPdf(input: RichPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const locale = input.locale;
  const rtl = locale === 'ar';
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  doc.setTitle(input.title);
  doc.setCreator('Innovation to Impact Reports');

  const fonts = await embedFonts(doc, locale);
  const logos = await embedLogos(doc);

  const cover = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, page: cover, fonts, logos, y: BODY_TOP, locale, rtl };
  drawCover(ctx, input, generatedAt);

  newPage(ctx);
  const availW = PAGE_W - MARGIN * 2;
  const gap = 16;
  const colW = (availW - gap) / 2;

  // Pre-render every chart PNG, then place. Large → full width; smalls pair up.
  const charts = input.spec.charts;
  let i = 0;
  while (i < charts.length) {
    const spec = charts[i];
    const datum = input.data[spec.dataKey];
    if (spec.size === 'large') {
      const png = renderSpecChart(spec, datum, { width: 980, height: 380 });
      const img = await doc.embedPng(png);
      const drawH = availW * (img.height / img.width);
      ensure(ctx, drawH + 30);
      drawChartTitle(ctx, MARGIN, availW, input.chartTitles[spec.id] ?? spec.id);
      const h = drawChartImage(ctx, img, MARGIN, availW);
      ctx.y -= h + 22;
      i += 1;
    } else {
      const next = charts[i + 1];
      const pair = next && next.size === 'small' ? next : null;
      const png1 = renderSpecChart(spec, datum, { width: 520, height: 340 });
      const img1 = await doc.embedPng(png1);
      const h1 = colW * (img1.height / img1.width);
      let img2: PDFImage | null = null;
      let h2 = 0;
      if (pair) {
        const png2 = renderSpecChart(pair, input.data[pair.dataKey], { width: 520, height: 340 });
        img2 = await doc.embedPng(png2);
        h2 = colW * (img2.height / img2.width);
      }
      const rowH = Math.max(h1, h2) + 22;
      ensure(ctx, rowH + 8);
      const titleY = ctx.y;
      drawChartTitle(ctx, MARGIN, colW, input.chartTitles[spec.id] ?? spec.id);
      if (pair) {
        ctx.y = titleY;
        drawChartTitle(ctx, MARGIN + colW + gap, colW, input.chartTitles[pair.id] ?? pair.id);
      }
      const imgTop = ctx.y;
      ctx.page.drawImage(img1, { x: mirrorX(rtl, MARGIN, colW), y: imgTop - h1, width: colW, height: h1 });
      if (img2) ctx.page.drawImage(img2, { x: mirrorX(rtl, MARGIN + colW + gap, colW), y: imgTop - h2, width: colW, height: h2 });
      ctx.y = imgTop - Math.max(h1, h2) - 22;
      i += pair ? 2 : 1;
    }
  }

  // Optional data-table appendix.
  if (input.spec.showTable) {
    for (const spec of charts) {
      const rows = categoricalTable(input.data[spec.dataKey]);
      if (rows) drawTable(ctx, input.chartTitles[spec.id] ?? spec.id, rows, locale);
    }
  }

  return doc.save();
}
