// Preview script: generate a sample PDF locally to inspect the renderer output.
// Run: node -r sucrase/register scripts/gen-sample-report.ts
import fs from 'node:fs';
import path from 'node:path';
import { renderPdf } from '../src/lib/reports/render-pdf';
import type { ReportBundle } from '../src/lib/reports/types';

// Realistic sample: Executive report over Q3 2026.
const sample: ReportBundle = {
  type: 'executive',
  generatedAt: new Date().toISOString(),
  generatedBy: 'raid.a.alghamdi@gac.gov.sa',
  dateFrom: '2026-01-01',
  dateTo: '2026-06-30',
  kpis: [
    { label_ar: 'إجمالي الأفكار المُقدَّمة', label_en: 'Total Submitted Ideas', value: '247' },
    { label_ar: 'أفكار مُعتمدة', label_en: 'Approved', value: '89' },
    { label_ar: 'أفكار غير مُعتمدة', label_en: 'Not Approved', value: '42' },
    { label_ar: 'قيد المعالجة', label_en: 'Under Review', value: '116' },
    { label_ar: 'قيد التنفيذ', label_en: 'In Implementation', value: '31' },
    { label_ar: 'معدل الاعتماد', label_en: 'Approval Rate', value: '36%' },
  ],
  sections: [
    {
      title_ar: 'توزيع الأفكار على المسارات الاستراتيجية',
      title_en: 'Distribution Across Strategic Themes',
      columns: [
        { key: 'theme', label_ar: 'المسار الاستراتيجي', label_en: 'Strategic Theme', width: 40 },
        { key: 'count', label_ar: 'عدد الأفكار', label_en: 'Ideas', width: 12 },
        { key: 'pct', label_ar: 'النسبة', label_en: 'Share', width: 12 },
      ],
      rows: [
        { theme: 'Digital Transformation & AI', count: 68, pct: '28%' },
        { theme: 'Customer Experience Excellence', count: 54, pct: '22%' },
        { theme: 'Operational Efficiency', count: 41, pct: '17%' },
        { theme: 'Sustainability & Green Ops', count: 33, pct: '13%' },
        { theme: 'Workforce Enablement', count: 28, pct: '11%' },
        { theme: 'Regulatory Compliance', count: 15, pct: '6%' },
        { theme: 'Unassigned', count: 8, pct: '3%' },
      ],
    },
    {
      title_ar: 'أبرز الأفكار قيد التنفيذ',
      title_en: 'Featured Ideas in Implementation',
      columns: [
        { key: 'code', label_ar: 'الرمز المرجعي', label_en: 'Reference', width: 14 },
        { key: 'title', label_ar: 'عنوان الفكرة', label_en: 'Idea Title', width: 44 },
        { key: 'theme', label_ar: 'المسار', label_en: 'Theme', width: 22 },
        { key: 'stage', label_ar: 'المرحلة', label_en: 'Stage', width: 12 },
        { key: 'submitted', label_ar: 'تاريخ التقديم', label_en: 'Submitted', width: 12 },
      ],
      rows: [
        { code: 'I2I-00142', title: 'AI-Powered Predictive SLA Escalation', theme: 'Digital Transformation & AI', stage: 'in_pilot', submitted: '2026-01-18' },
        { code: 'I2I-00156', title: 'Bilingual Chatbot for Innovator Support', theme: 'Customer Experience', stage: 'in_pilot', submitted: '2026-02-04' },
        { code: 'I2I-00171', title: 'Automated Committee Quorum Scheduling', theme: 'Operational Efficiency', stage: 'scaling', submitted: '2026-02-19' },
        { code: 'I2I-00189', title: 'Solar-Powered Regional Hub Retrofit', theme: 'Sustainability & Green Ops', stage: 'benefits_tracking', submitted: '2026-03-02' },
        { code: 'I2I-00203', title: 'Real-Time Analytics for Field Operations', theme: 'Operational Efficiency', stage: 'in_pilot', submitted: '2026-03-11' },
        { code: 'I2I-00218', title: 'Voice-Activated Compliance Reporting', theme: 'Regulatory Compliance', stage: 'in_pilot', submitted: '2026-03-24' },
        { code: 'I2I-00229', title: 'Cross-Departmental Knowledge Graph', theme: 'Workforce Enablement', stage: 'scaling', submitted: '2026-04-06' },
        { code: 'I2I-00234', title: 'Automated Contract Redline Assistant', theme: 'Digital Transformation & AI', stage: 'in_pilot', submitted: '2026-04-15' },
      ],
    },
    {
      title_ar: 'الأداء الشهري خلال الفترة',
      title_en: 'Monthly Performance Trend',
      columns: [
        { key: 'month', label_ar: 'الشهر', label_en: 'Month', width: 20 },
        { key: 'submitted', label_ar: 'الأفكار المُقدَّمة', label_en: 'Submitted', width: 20 },
        { key: 'approved', label_ar: 'المُعتمدة', label_en: 'Approved', width: 20 },
        { key: 'rate', label_ar: 'معدل الاعتماد', label_en: 'Approval Rate', width: 20 },
      ],
      rows: [
        { month: '2026-01', submitted: 34, approved: 11, rate: '32%' },
        { month: '2026-02', submitted: 41, approved: 15, rate: '37%' },
        { month: '2026-03', submitted: 45, approved: 17, rate: '38%' },
        { month: '2026-04', submitted: 38, approved: 14, rate: '37%' },
        { month: '2026-05', submitted: 47, approved: 18, rate: '38%' },
        { month: '2026-06', submitted: 42, approved: 14, rate: '33%' },
      ],
    },
  ],
  totalRowCount: 21,
};

const outDir = path.resolve(process.cwd(), '..');

async function main() {
  const bytesEn = await renderPdf(sample, 'en');
  const enPath = path.join(outDir, 'sample-report-en.pdf');
  fs.writeFileSync(enPath, bytesEn);
  console.log('Wrote', enPath, bytesEn.length, 'bytes');

  const bytesAr = await renderPdf(sample, 'ar');
  const arPath = path.join(outDir, 'sample-report-ar.pdf');
  fs.writeFileSync(arPath, bytesAr);
  console.log('Wrote', arPath, bytesAr.length, 'bytes');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
