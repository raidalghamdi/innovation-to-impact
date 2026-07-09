// PDF committee pack + single-idea brief via pdf-lib. Arabic is rendered with
// an embedded IBM Plex Sans Arabic font: pdf-lib's custom-font embedder runs
// fontkit's `layout()`, which applies GSUB/GPOS shaping (contextual Arabic
// forms) and RTL ordering, so pure-Arabic runs come out correctly connected
// and right-to-left. jsPDF cannot do this — hence pdf-lib + fontkit.
//
// Bilingual layout choice: ONE document with both languages side-by-side on
// each page — English in the LEFT column, Arabic in the RIGHT column (right-
// aligned). This keeps a single artefact reviewers can print duplex, and lets
// each idea's AR/EN content sit adjacent for easy comparison.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { BRAND, generationFooter, rgb01 } from './branding';
import {
  gatherIdeasDataset,
  themeName,
  userName,
  type IdeasDataset,
} from './dataset';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type { Idea } from '@/lib/demo-data';

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 48;
const COL_GAP = 24;
const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP) / 2;
const LEFT_X = MARGIN; // English column
const RIGHT_X = MARGIN + COL_W + COL_GAP; // Arabic column
const PRIMARY = rgb(...rgb01(BRAND.primary));
const TEXT = rgb(...rgb01(BRAND.text));
const MUTED = rgb(...rgb01(BRAND.muted));

const FONT_DIR = path.join(process.cwd(), 'src/lib/exports/fonts');

function loadArabicFont(bold: boolean): Uint8Array | null {
  try {
    return fs.readFileSync(path.join(FONT_DIR, `ibm-plex-sans-arabic-${bold ? 700 : 400}.ttf`));
  } catch {
    return null;
  }
}

type Fonts = {
  latin: PDFFont;
  latinBold: PDFFont;
  ar: PDFFont; // falls back to latin when the TTF can't be read
  arBold: PDFFont;
};

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arReg = loadArabicFont(false);
  const arBoldBytes = loadArabicFont(true);
  const ar = arReg ? await doc.embedFont(arReg, { subset: true }) : latin;
  const arBold = arBoldBytes ? await doc.embedFont(arBoldBytes, { subset: true }) : latinBold;
  return { latin, latinBold, ar, arBold };
}

// Greedy word-wrap for a given font/size within maxWidth. Works for both LTR
// and RTL text (RTL visual ordering is handled by fontkit at draw time).
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// A cursor tracking the y position of each of the two columns independently so
// AR and EN blocks can grow at their own pace and we can page-break on either.
class Layout {
  doc: PDFDocument;
  fonts: Fonts;
  page!: PDFPage;
  yLeft = 0;
  yRight = 0;
  private generatedBy: string;

  constructor(doc: PDFDocument, fonts: Fonts, generatedBy: string) {
    this.doc = doc;
    this.fonts = fonts;
    this.generatedBy = generatedBy;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.yLeft = PAGE_H - MARGIN;
    this.yRight = PAGE_H - MARGIN;
    this.footer();
    return this.page;
  }

  private footer() {
    const text = generationFooter(this.generatedBy, 'en');
    this.page.drawText(text, {
      x: MARGIN,
      y: MARGIN / 2,
      size: 7,
      font: this.fonts.latin,
      color: MUTED,
    });
  }

  // Ensure both columns have at least `need` points of vertical room.
  ensure(need: number) {
    if (Math.min(this.yLeft, this.yRight) - need < MARGIN + 12) this.newPage();
  }

  // Draw a left-aligned (English) paragraph in the left column.
  en(text: string, size: number, bold = false, gap = 4) {
    const font = bold ? this.fonts.latinBold : this.fonts.latin;
    const lines = wrapText(font, text, size, COL_W);
    for (const line of lines) {
      this.ensure(size + gap);
      this.page.drawText(line, { x: LEFT_X, y: this.yLeft - size, size, font, color: TEXT });
      this.yLeft -= size + gap;
    }
  }

  // Draw a right-aligned (Arabic) paragraph in the right column.
  ar(text: string, size: number, bold = false, gap = 4) {
    const font = bold ? this.fonts.arBold : this.fonts.ar;
    const lines = wrapText(font, text, size, COL_W);
    for (const line of lines) {
      this.ensure(size + gap);
      const w = font.widthOfTextAtSize(line, size);
      const x = RIGHT_X + COL_W - w; // right-align within the RTL column
      this.page.drawText(line, { x, y: this.yRight - size, size, font, color: TEXT });
      this.yRight -= size + gap;
    }
  }

  // A bilingual field: EN label+value left, AR label+value right, kept level.
  bilingualField(labelEn: string, valueEn: string, labelAr: string, valueAr: string) {
    const before = Math.min(this.yLeft, this.yRight);
    this.yLeft = before;
    this.yRight = before;
    this.en(labelEn, 8, true, 2);
    this.ar(labelAr, 8, true, 2);
    const rowTop = Math.min(this.yLeft, this.yRight);
    this.yLeft = rowTop;
    this.yRight = rowTop;
    this.en(valueEn || '—', 10, false, 4);
    this.ar(valueAr || '—', 10, false, 4);
    const rowBottom = Math.min(this.yLeft, this.yRight);
    this.yLeft = rowBottom - 6;
    this.yRight = rowBottom - 6;
  }

  rule() {
    const y = Math.min(this.yLeft, this.yRight) - 2;
    this.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: MUTED,
    });
    this.yLeft = y - 10;
    this.yRight = y - 10;
  }

  brandBar(titleEn: string, titleAr: string) {
    this.page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: PRIMARY });
    this.page.drawText(titleEn, {
      x: MARGIN,
      y: PAGE_H - 44,
      size: 16,
      font: this.fonts.latinBold,
      color: rgb(1, 1, 1),
    });
    const w = this.fonts.arBold.widthOfTextAtSize(titleAr, 16);
    this.page.drawText(titleAr, {
      x: PAGE_W - MARGIN - w,
      y: PAGE_H - 44,
      size: 16,
      font: this.fonts.arBold,
      color: rgb(1, 1, 1),
    });
    this.yLeft = PAGE_H - 90;
    this.yRight = PAGE_H - 90;
  }
}

function evalSummaryLine(dataset: IdeasDataset, ideaId: string): { en: string; ar: string } {
  const s = dataset.evaluations[ideaId];
  if (!s || !s.count) return { en: 'No evaluations submitted.', ar: 'لا توجد تقييمات.' };
  const avg = s.avgTotal ?? 0;
  return {
    en: `${s.count} evaluations · avg ${avg} · ${s.conflicts} conflict(s)`,
    ar: `${s.count} تقييمات · المتوسط ${avg} · ${s.conflicts} تعارض`,
  };
}

async function evidenceNames(entityId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('evidence_attachments')
    .select('file_name, linked_entity_type, linked_entity_id')
    .eq('linked_entity_type', 'idea')
    .eq('linked_entity_id', entityId);
  return ((data as Array<{ file_name?: string }> | null) ?? [])
    .map((r) => r.file_name ?? '')
    .filter(Boolean);
}

function renderIdea(l: Layout, dataset: IdeasDataset, idea: Idea, evidence: string[]) {
  l.ensure(200);
  l.en(idea.code, 11, true, 6);
  l.bilingualField('Title', idea.title_en, 'العنوان', idea.title_ar);
  l.bilingualField(
    'Submitter',
    userName(dataset.userById.get(idea.submitter_id)),
    'مقدّم الفكرة',
    userName(dataset.userById.get(idea.submitter_id))
  );
  l.bilingualField(
    'Pillar',
    themeName(dataset.themeById.get(idea.strategic_theme_id), 'en'),
    'المحور',
    themeName(dataset.themeById.get(idea.strategic_theme_id), 'ar')
  );
  l.bilingualField(
    'Problem statement',
    idea.problem_statement,
    'المشكلة',
    idea.problem_statement
  );

  const es = evalSummaryLine(dataset, idea.id);
  l.bilingualField('Evaluation summary', es.en, 'ملخص التقييم', es.ar);

  const s = dataset.evaluations[idea.id];
  if (s) {
    for (const sc of s.scorecards) {
      if (sc.comments) {
        l.en(`— ${sc.evaluatorName}: ${sc.comments}`, 9, false, 3);
        l.ar(`— ${sc.evaluatorName}: ${sc.comments}`, 9, false, 3);
      }
    }
  }

  if (evidence.length) {
    l.bilingualField(
      'Attached evidence',
      evidence.join(', '),
      'المرفقات',
      evidence.join('، ')
    );
  }
  l.rule();
}

export type CommitteePackOpts = {
  sessionDate: string;
  ideaIds: string[];
  locale?: string;
  generatedBy: string;
};

export async function generateCommitteePack(opts: CommitteePackOpts): Promise<Buffer> {
  const dataset = await gatherIdeasDataset({ ideaIds: opts.ideaIds });
  const doc = await PDFDocument.create();
  doc.setTitle('Committee Pack');
  doc.setAuthor(opts.generatedBy);
  const fonts = await embedFonts(doc);
  const l = new Layout(doc, fonts, opts.generatedBy);

  const ideas = dataset.ideas;

  // Cover page
  l.newPage();
  l.brandBar('Committee Pack', 'حزمة اللجنة');
  l.yLeft -= 20;
  l.yRight -= 20;
  l.en(`Session date: ${opts.sessionDate}`, 12, true, 8);
  l.ar(`تاريخ الجلسة: ${opts.sessionDate}`, 12, true, 8);
  l.en(`${ideas.length} ideas in this pack`, 11, false, 6);
  l.ar(`${ideas.length} أفكار في هذه الحزمة`, 11, false, 6);

  // TOC
  l.newPage();
  l.en('Table of contents', 14, true, 10);
  l.ar('المحتويات', 14, true, 10);
  for (const i of ideas) {
    l.en(`${i.code} — ${i.title_en}`, 10, false, 4);
    l.ar(`${i.code} — ${i.title_ar}`, 10, false, 4);
  }
  l.rule();

  // Per-idea pages
  for (const idea of ideas) {
    l.newPage();
    const ev = await evidenceNames(idea.id);
    renderIdea(l, dataset, idea, ev);
  }

  // Summary + sign-off page
  l.newPage();
  l.en('Summary & sign-off', 14, true, 10);
  l.ar('الملخص والاعتماد', 14, true, 10);
  const totalEvals = Object.values(dataset.evaluations).reduce((n, s) => n + s.count, 0);
  l.en(`Ideas reviewed: ${ideas.length} · Evaluations considered: ${totalEvals}`, 10, false, 6);
  l.ar(`الأفكار المراجَعة: ${ideas.length} · التقييمات: ${totalEvals}`, 10, false, 6);
  l.rule();
  l.en('Chair signature: ____________________', 11, false, 20);
  l.ar('توقيع الرئيس: ____________________', 11, false, 20);
  l.en('Date: ____________________', 11, false, 8);
  l.ar('التاريخ: ____________________', 11, false, 8);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export type IdeaBriefOpts = {
  ideaId: string;
  locale?: string;
  generatedBy: string;
};

export async function generateIdeaBrief(opts: IdeaBriefOpts): Promise<Buffer | null> {
  const dataset = await gatherIdeasDataset({ ideaIds: [opts.ideaId] });
  const idea = dataset.ideas.find((i) => i.id === opts.ideaId);
  if (!idea) return null;

  const doc = await PDFDocument.create();
  doc.setTitle(`Idea brief — ${idea.code}`);
  doc.setAuthor(opts.generatedBy);
  const fonts = await embedFonts(doc);
  const l = new Layout(doc, fonts, opts.generatedBy);

  l.newPage();
  l.brandBar('Idea Brief', 'موجز الفكرة');
  l.yLeft -= 16;
  l.yRight -= 16;
  const ev = await evidenceNames(idea.id);
  renderIdea(l, dataset, idea, ev);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
