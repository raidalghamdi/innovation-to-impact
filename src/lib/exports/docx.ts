// DOCX export via the `docx` library. Produces a bilingual idea document:
// English sections are LTR/left-aligned, Arabic sections set `bidirectional`
// (bidi=true) with right alignment so Word renders them RTL correctly.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { BRAND, FONT_LATIN, FONT_ARABIC, generationFooter } from './branding';
import { gatherIdeasDataset, themeName, userName } from './dataset';

function enHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, font: FONT_LATIN, color: BRAND.primary })],
  });
}

function enPara(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: text || '—', font: FONT_LATIN, color: BRAND.text })],
  });
}

function arHeading(text: string): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text, bold: true, font: FONT_ARABIC, color: BRAND.primary, rightToLeft: true })],
  });
}

function arPara(text: string): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: text || '—', font: FONT_ARABIC, color: BRAND.text, rightToLeft: true })],
  });
}

export type IdeaDocxOpts = {
  ideaId: string;
  locale?: string;
  generatedBy: string;
};

export async function generateIdeaDocx(opts: IdeaDocxOpts): Promise<Buffer | null> {
  const dataset = await gatherIdeasDataset({ ideaIds: [opts.ideaId] });
  const idea = dataset.ideas.find((i) => i.id === opts.ideaId);
  if (!idea) return null;

  const submitter = userName(dataset.userById.get(idea.submitter_id));
  const pillarEn = themeName(dataset.themeById.get(idea.strategic_theme_id), 'en');
  const pillarAr = themeName(dataset.themeById.get(idea.strategic_theme_id), 'ar');

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: idea.code, bold: true, size: 28, font: FONT_LATIN, color: BRAND.primary })],
    }),

    enHeading('Title'),
    enPara(idea.title_en),
    arHeading('العنوان'),
    arPara(idea.title_ar),

    enHeading('Submitter'),
    enPara(submitter),
    arHeading('مقدّم الفكرة'),
    arPara(submitter),

    enHeading('Pillar'),
    enPara(pillarEn),
    arHeading('المحور'),
    arPara(pillarAr),

    enHeading('Problem statement'),
    enPara(idea.problem_statement),
    arHeading('المشكلة'),
    arPara(idea.problem_statement),

    enHeading('Proposed solution'),
    enPara(idea.proposed_solution),
    arHeading('الحل المقترح'),
    arPara(idea.proposed_solution),

    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: generationFooter(opts.generatedBy, opts.locale ?? 'en'),
          italics: true,
          size: 16,
          font: FONT_LATIN,
          color: BRAND.muted,
        }),
      ],
    }),
  ];

  const doc = new Document({
    creator: opts.generatedBy,
    title: `Idea ${idea.code}`,
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
