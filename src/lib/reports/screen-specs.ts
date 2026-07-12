// Registry mapping a screenId → the ordered set of charts that make up that
// screen's rich report. Titles are i18n keys (resolved at render time, with the
// editable report_titles overrides taking precedence). One spec per admin
// screen; the supervisor scope reuses the same layout (its data is filtered by
// department upstream in live-queries), so supervisor.* is derived from admin.*.
//
// `dataKey` must match a key returned by the corresponding live-queries screen
// function. `size` drives layout: 'large' charts take a full row, 'small'
// charts pair two-per-row in the PDF grid.

export type ChartSize = 'small' | 'large';

export type ChartSpec = {
  id: string;
  type: string; // ChartType from ./charts/renderChart
  titleKey: string;
  dataKey: string;
  size: ChartSize;
};

export type ScreenSpec = {
  titleKey: string;
  charts: ChartSpec[];
  showTable: boolean;
};

const c = (id: string, type: string, dataKey: string, size: ChartSize, screen: string): ChartSpec => ({
  id,
  type,
  dataKey,
  size,
  titleKey: `reports.${screen}.charts.${id}.title`,
});

const ADMIN: Record<string, ScreenSpec> = {
  analytics: {
    titleKey: 'reports.analytics.title',
    showTable: false,
    charts: [
      c('submissionsOverTime', 'line', 'submissionsOverTime', 'large', 'analytics'),
      c('weeklyTrend', 'bar', 'weeklyTrend', 'small', 'analytics'),
      c('ideasByStage', 'bar', 'ideasByStage', 'small', 'analytics'),
      c('ideasByTrack', 'bar', 'ideasByTrack', 'small', 'analytics'),
      c('ideasByChallenge', 'donut', 'ideasByChallenge', 'small', 'analytics'),
      c('conversionFunnel', 'funnel', 'conversionFunnel', 'large', 'analytics'),
      c('evaluationWorkload', 'bar', 'evaluationWorkload', 'small', 'analytics'),
      c('top10Innovators', 'bar', 'top10Innovators', 'small', 'analytics'),
    ],
  },
  ideas: {
    titleKey: 'reports.ideas.title',
    showTable: true,
    charts: [
      c('ideasByStatus', 'donut', 'ideasByStatus', 'small', 'ideas'),
      c('ideasByStage', 'bar', 'ideasByStage', 'small', 'ideas'),
      c('ideasByTrack', 'bar', 'ideasByTrack', 'small', 'ideas'),
      c('ideasByChallenge', 'bar', 'ideasByChallenge', 'small', 'ideas'),
      c('submissionsOverTime', 'area', 'submissionsOverTime', 'large', 'ideas'),
      c('topInnovators', 'bar', 'top10Innovators', 'small', 'ideas'),
    ],
  },
  evaluations: {
    titleKey: 'reports.evaluations.title',
    showTable: true,
    charts: [
      c('avgScores', 'bar', 'avgScores', 'small', 'evaluations'),
      c('evaluatorDistribution', 'donut', 'evaluatorDistribution', 'small', 'evaluations'),
      c('status', 'donut', 'evalStatus', 'small', 'evaluations'),
      c('processingTime', 'bar', 'processingTime', 'small', 'evaluations'),
      c('interRaterAgreement', 'scatter', 'interRaterAgreement', 'large', 'evaluations'),
    ],
  },
  users: {
    titleKey: 'reports.users.title',
    showTable: true,
    charts: [
      c('byRole', 'donut', 'usersByRole', 'small', 'users'),
      c('byDepartment', 'bar', 'usersByDepartment', 'small', 'users'),
      c('monthlyActivity', 'line', 'userMonthlyActivity', 'large', 'users'),
      c('lastLoginDistribution', 'bar', 'lastLoginDistribution', 'small', 'users'),
    ],
  },
  auditLogs: {
    titleKey: 'reports.auditLogs.title',
    showTable: true,
    charts: [
      c('byAction', 'bar', 'auditByAction', 'small', 'auditLogs'),
      c('byEntityType', 'donut', 'auditByEntityType', 'small', 'auditLogs'),
      c('byActor', 'bar', 'auditByActor', 'small', 'auditLogs'),
      c('overTime', 'line', 'auditOverTime', 'large', 'auditLogs'),
    ],
  },
  escalations: {
    titleKey: 'reports.escalations.title',
    showTable: true,
    charts: [
      c('byStatus', 'donut', 'escalationsByStatus', 'small', 'escalations'),
      c('byLevel', 'bar', 'escalationsByLevel', 'small', 'escalations'),
      c('resolutionTime', 'bar', 'escalationResolutionTime', 'small', 'escalations'),
      c('byType', 'bar', 'escalationsByType', 'small', 'escalations'),
    ],
  },
  support: {
    titleKey: 'reports.support.title',
    showTable: true,
    charts: [
      c('volume', 'line', 'supportVolume', 'large', 'support'),
      c('responseTime', 'bar', 'supportResponseTime', 'small', 'support'),
      c('resolutionRate', 'donut', 'supportResolutionRate', 'small', 'support'),
      c('byHandler', 'bar', 'supportByHandler', 'small', 'support'),
    ],
  },
  compliance: {
    titleKey: 'reports.compliance.title',
    showTable: true,
    charts: [
      c('complianceRate', 'donut', 'complianceRate', 'small', 'compliance'),
      c('byStandard', 'bar', 'complianceByStandard', 'small', 'compliance'),
      c('status', 'donut', 'complianceStatus', 'small', 'compliance'),
    ],
  },
  reports: {
    titleKey: 'reports.reports.title',
    showTable: false,
    charts: [
      c('submissionsOverTime', 'line', 'submissionsOverTime', 'large', 'reports'),
      c('conversionFunnel', 'funnel', 'conversionFunnel', 'large', 'reports'),
      c('ideasByTrack', 'bar', 'ideasByTrack', 'small', 'reports'),
      c('ideasByStatus', 'donut', 'ideasByStatus', 'small', 'reports'),
      c('avgScores', 'bar', 'avgScores', 'small', 'reports'),
      c('top10Innovators', 'bar', 'top10Innovators', 'small', 'reports'),
      c('usersByRole', 'donut', 'usersByRole', 'small', 'reports'),
      c('auditByAction', 'bar', 'auditByAction', 'small', 'reports'),
      c('escalationsByStatus', 'donut', 'escalationsByStatus', 'small', 'reports'),
      c('complianceByStandard', 'bar', 'complianceByStandard', 'small', 'reports'),
    ],
  },
};

// Horizontal-bar hint: category-heavy bars read better horizontally.
const HORIZONTAL = new Set([
  'ideasByTrack',
  'ideasByChallenge',
  'evaluationWorkload',
  'top10Innovators',
  'topInnovators',
  'byDepartment',
  'byAction',
  'byActor',
  'byType',
  'byHandler',
]);

export function isHorizontal(chartId: string): boolean {
  return HORIZONTAL.has(chartId);
}

// Build the full registry: 9 admin + 9 supervisor screens.
export const SCREEN_SPECS: Record<string, ScreenSpec> = (() => {
  const out: Record<string, ScreenSpec> = {};
  for (const [key, spec] of Object.entries(ADMIN)) {
    out[`admin.${key}`] = spec;
    out[`supervisor.${key}`] = { ...spec, charts: spec.charts.map((ch) => ({ ...ch })) };
  }
  return out;
})();

export const ALL_SCREEN_IDS: string[] = Object.keys(SCREEN_SPECS);

export function getScreenSpec(screenId: string): ScreenSpec | undefined {
  return SCREEN_SPECS[screenId];
}
