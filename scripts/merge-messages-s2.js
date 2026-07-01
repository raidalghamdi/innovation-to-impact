// Deep-merges Session 2 i18n keys into messages/en.json and messages/ar.json.
const fs = require('fs');
const path = require('path');

const EN = {
  nav: {
    leaderboard: 'Leaderboard',
    adminAnalytics: 'Analytics',
  },
  leaderboard: {
    title: 'Leaderboard',
    subtitle: 'Top contributors ranked by points earned across the platform.',
    rank: 'Rank',
    name: 'Name',
    role: 'Role',
    level: 'Level',
    points: 'Points',
    badges: 'Badges',
    you: 'You',
    yourRank: 'Your rank',
    topThree: 'Top contributors',
    empty: 'No ranked contributors yet. Submit and progress ideas to earn points.',
    pointsUnit: 'pts',
    levelShort: 'Lv',
  },
  gamification: {
    title: 'Your progress',
    subtitle: 'Earn points and badges as your ideas move through the pipeline.',
    points: 'Points',
    level: 'Level',
    nextLevel: '{n} points to next level',
    badgesTitle: 'Badges',
    badgesEarned: '{earned} of {total} earned',
    earned: 'Earned',
    locked: 'Locked',
    earnedOn: 'Earned {date}',
    viewLeaderboard: 'View leaderboard',
    badge_first_idea: 'First Idea',
    badge_first_idea_desc: 'Submitted your first idea.',
    badge_approved_idea: 'Approved Idea',
    badge_approved_idea_desc: 'One of your ideas was approved.',
    badge_evaluator_5: 'Seasoned Evaluator',
    badge_evaluator_5_desc: 'Completed five evaluations.',
    badge_implemented: 'Implemented',
    badge_implemented_desc: 'An idea you submitted reached implementation.',
  },
  similarity: {
    title: 'Ideas similar to yours',
    checking: 'Checking for similar ideas…',
    match: '{pct}% match',
    view: 'View',
    nudgeTitle: 'Similar ideas already exist',
    nudge: 'Consider refining your idea or joining an existing one to strengthen its impact.',
    relatedTitle: 'Related ideas',
    relatedEmpty: 'No related ideas found.',
  },
  analytics: {
    adminTitle: 'Platform analytics',
    adminSubtitle: 'Submissions, conversion, and contributor activity across the platform.',
    kpiSubmissions: 'Total submissions',
    kpiApproved: 'Approved',
    kpiImplemented: 'Implemented',
    kpiActiveSubmitters: 'Active submitters',
    kpiEvaluations: 'Evaluations',
    kpiUsers: 'Total users',
    kpiEvaluators: 'Evaluators',
    kpiFinancialImpact: 'Realized impact (SAR)',
    funnelTitle: 'Lifecycle funnel',
    funnelSubtitle: 'Ideas by lifecycle stage.',
    cohortTitle: 'Monthly cohorts',
    cohortSubtitle: 'Submitted, approved, rejected, and implemented per month.',
    themeTitle: 'Theme activity',
    themeSubtitle: 'Ideas and approvals per strategic theme.',
    evaluatorsTitle: 'Top evaluators',
    evaluatorsSubtitle: 'Most active evaluators and their average score.',
    theme: 'Theme',
    ideas: 'Ideas',
    approved: 'Approved',
    evaluator: 'Evaluator',
    evaluations: 'Evaluations',
    avgScore: 'Avg. score',
    submitted: 'Submitted',
    rejected: 'Rejected',
    implemented: 'Implemented',
    empty: 'No data available yet.',
  },
};

const AR = {
  nav: {
    leaderboard: 'لوحة المتصدرين',
    adminAnalytics: 'التحليلات',
  },
  leaderboard: {
    title: 'لوحة المتصدرين',
    subtitle: 'أبرز المساهمين مرتبين حسب النقاط المكتسبة عبر المنصة.',
    rank: 'الترتيب',
    name: 'الاسم',
    role: 'الدور',
    level: 'المستوى',
    points: 'النقاط',
    badges: 'الأوسمة',
    you: 'أنت',
    yourRank: 'ترتيبك',
    topThree: 'أبرز المساهمين',
    empty: 'لا يوجد مساهمون مصنّفون بعد. قدّم أفكاراً وطوّرها لكسب النقاط.',
    pointsUnit: 'نقطة',
    levelShort: 'مستوى',
  },
  gamification: {
    title: 'تقدّمك',
    subtitle: 'اكسب النقاط والأوسمة مع تقدّم أفكارك عبر المسار.',
    points: 'النقاط',
    level: 'المستوى',
    nextLevel: '{n} نقطة للمستوى التالي',
    badgesTitle: 'الأوسمة',
    badgesEarned: '{earned} من {total} مكتسبة',
    earned: 'مكتسب',
    locked: 'مقفل',
    earnedOn: 'اكتُسب في {date}',
    viewLeaderboard: 'عرض لوحة المتصدرين',
    badge_first_idea: 'الفكرة الأولى',
    badge_first_idea_desc: 'قدّمت فكرتك الأولى.',
    badge_approved_idea: 'فكرة معتمدة',
    badge_approved_idea_desc: 'تمت الموافقة على إحدى أفكارك.',
    badge_evaluator_5: 'مُقيّم متمرّس',
    badge_evaluator_5_desc: 'أكملت خمسة تقييمات.',
    badge_implemented: 'قيد التنفيذ',
    badge_implemented_desc: 'وصلت فكرة قدّمتها إلى مرحلة التنفيذ.',
  },
  similarity: {
    title: 'أفكار مشابهة لفكرتك',
    checking: 'جارٍ البحث عن أفكار مشابهة…',
    match: 'تطابق {pct}٪',
    view: 'عرض',
    nudgeTitle: 'توجد أفكار مشابهة بالفعل',
    nudge: 'فكّر في تحسين فكرتك أو الانضمام إلى فكرة قائمة لتعزيز أثرها.',
    relatedTitle: 'أفكار ذات صلة',
    relatedEmpty: 'لا توجد أفكار ذات صلة.',
  },
  analytics: {
    adminTitle: 'تحليلات المنصة',
    adminSubtitle: 'التقديمات والتحويل ونشاط المساهمين عبر المنصة.',
    kpiSubmissions: 'إجمالي التقديمات',
    kpiApproved: 'المعتمدة',
    kpiImplemented: 'المنفّذة',
    kpiActiveSubmitters: 'المساهمون النشطون',
    kpiEvaluations: 'التقييمات',
    kpiUsers: 'إجمالي المستخدمين',
    kpiEvaluators: 'المُقيّمون',
    kpiFinancialImpact: 'الأثر المتحقق (ريال)',
    funnelTitle: 'قمع دورة الحياة',
    funnelSubtitle: 'الأفكار حسب مرحلة دورة الحياة.',
    cohortTitle: 'الأفواج الشهرية',
    cohortSubtitle: 'المقدَّمة والمعتمدة والمرفوضة والمنفّذة شهرياً.',
    themeTitle: 'نشاط المحاور',
    themeSubtitle: 'الأفكار والاعتمادات لكل محور استراتيجي.',
    evaluatorsTitle: 'أبرز المُقيّمين',
    evaluatorsSubtitle: 'أكثر المُقيّمين نشاطاً ومعدّل درجاتهم.',
    theme: 'المحور',
    ideas: 'الأفكار',
    approved: 'المعتمدة',
    evaluator: 'المُقيّم',
    evaluations: 'التقييمات',
    avgScore: 'متوسط الدرجة',
    submitted: 'المقدَّمة',
    rejected: 'المرفوضة',
    implemented: 'المنفّذة',
    empty: 'لا توجد بيانات بعد.',
  },
};

function deepMerge(target, src) {
  for (const key of Object.keys(src)) {
    if (
      src[key] &&
      typeof src[key] === 'object' &&
      !Array.isArray(src[key])
    ) {
      target[key] = deepMerge(target[key] || {}, src[key]);
    } else {
      target[key] = src[key];
    }
  }
  return target;
}

function apply(file, additions) {
  const p = path.join(__dirname, '..', 'messages', file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  deepMerge(json, additions);
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('updated', file);
}

apply('en.json', EN);
apply('ar.json', AR);
