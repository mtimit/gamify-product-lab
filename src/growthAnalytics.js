// src/growthAnalytics.js
// Расчет growth метрик и ROI для дистрибуционных экспериментов (App Mafia inspired)

// Расчет ROI для distribution experiment
export function calculateROI(experiment) {
  const { spent, installs, arpu } = experiment.metrics;
  
  if (spent === 0 || installs === 0) return null;
  
  const revenue = installs * arpu;
  const roi = ((revenue - spent) / spent) * 100;
  
  return {
    revenue: revenue.toFixed(2),
    roi: roi.toFixed(2),
    profitable: roi > 0
  };
}

// Расчет средних метрик по всем экспериментам
export function calculateOverallGrowthMetrics(state) {
  const exps = state.distributionExperiments;
  
  if (exps.length === 0) {
    return {
      totalExperiments: 0,
      totalInstalls: 0,
      totalSpent: 0,
      avgCPI: 0,
      avgRetentionR1: 0,
      avgRetentionR7: 0,
      avgRetentionR30: 0,
      avgARPU: 0,
      avgLTV: 0,
      avgKFactor: 0,
      totalRevenue: 0,
      overallROI: 0,
      profitableChannels: 0
    };
  }
  
  const completed = exps.filter(e => e.status === 'completed');
  const running = exps.filter(e => e.status === 'running');
  
  const totalInstalls = exps.reduce((sum, e) => sum + e.metrics.installs, 0);
  const totalSpent = exps.reduce((sum, e) => sum + e.metrics.spent, 0);
  const totalRevenue = exps.reduce((sum, e) => sum + (e.metrics.installs * e.metrics.arpu), 0);
  
  // Средние метрики (только из completed experiments с данными)
  const withData = completed.filter(e => e.metrics.installs > 0);
  const count = withData.length || 1;
  
  const avgCPI = withData.reduce((sum, e) => sum + parseFloat(e.metrics.cpi || 0), 0) / count;
  const avgRetentionR1 = withData.reduce((sum, e) => sum + e.metrics.retentionR1, 0) / count;
  const avgRetentionR7 = withData.reduce((sum, e) => sum + e.metrics.retentionR7, 0) / count;
  const avgRetentionR30 = withData.reduce((sum, e) => sum + e.metrics.retentionR30, 0) / count;
  const avgARPU = withData.reduce((sum, e) => sum + e.metrics.arpu, 0) / count;
  const avgLTV = withData.reduce((sum, e) => sum + e.metrics.ltv, 0) / count;
  const avgKFactor = withData.reduce((sum, e) => sum + e.metrics.kFactor, 0) / count;
  
  const overallROI = totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;
  const profitableChannels = withData.filter(e => {
    const roi = calculateROI(e);
    return roi && roi.profitable;
  }).length;
  
  return {
    totalExperiments: exps.length,
    completedExperiments: completed.length,
    runningExperiments: running.length,
    totalInstalls,
    totalSpent: totalSpent.toFixed(2),
    avgCPI: avgCPI.toFixed(2),
    avgRetentionR1: avgRetentionR1.toFixed(1),
    avgRetentionR7: avgRetentionR7.toFixed(1),
    avgRetentionR30: avgRetentionR30.toFixed(1),
    avgARPU: avgARPU.toFixed(2),
    avgLTV: avgLTV.toFixed(2),
    avgKFactor: avgKFactor.toFixed(2),
    totalRevenue: totalRevenue.toFixed(2),
    overallROI: overallROI.toFixed(2),
    profitableChannels
  };
}

// Анализ по каналам (App Mafia: TikTok Ads, Reddit, ASO, Influencers, etc)
export function analyzeByChannel(state) {
  const exps = state.distributionExperiments;
  const channels = {};
  
  exps.forEach(exp => {
    if (!channels[exp.channel]) {
      channels[exp.channel] = {
        channel: exp.channel,
        experiments: 0,
        totalInstalls: 0,
        totalSpent: 0,
        totalRevenue: 0,
        avgCPI: 0,
        avgRetention: 0,
        avgARPU: 0,
        roi: 0
      };
    }
    
    const ch = channels[exp.channel];
    ch.experiments++;
    ch.totalInstalls += exp.metrics.installs;
    ch.totalSpent += exp.metrics.spent;
    ch.totalRevenue += exp.metrics.installs * exp.metrics.arpu;
  });
  
  // Вычисляем средние для каждого канала
  Object.values(channels).forEach(ch => {
    const channelExps = exps.filter(e => e.channel === ch.channel && e.metrics.installs > 0);
    const count = channelExps.length || 1;
    
    ch.avgCPI = (channelExps.reduce((sum, e) => sum + parseFloat(e.metrics.cpi || 0), 0) / count).toFixed(2);
    ch.avgRetention = (channelExps.reduce((sum, e) => sum + e.metrics.retentionR7, 0) / count).toFixed(1);
    ch.avgARPU = (channelExps.reduce((sum, e) => sum + e.metrics.arpu, 0) / count).toFixed(2);
    ch.roi = ch.totalSpent > 0 ? (((ch.totalRevenue - ch.totalSpent) / ch.totalSpent) * 100).toFixed(2) : 0;
    ch.totalSpent = ch.totalSpent.toFixed(2);
    ch.totalRevenue = ch.totalRevenue.toFixed(2);
  });
  
  return Object.values(channels).sort((a, b) => b.totalInstalls - a.totalInstalls);
}

// Топ-3 лучших каналов по ROI
export function getBestChannels(state) {
  const channels = analyzeByChannel(state);
  return channels
    .filter(ch => parseFloat(ch.roi) > 0)
    .sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi))
    .slice(0, 3);
}

// Худшие каналы (negative ROI)
export function getWorstChannels(state) {
  const channels = analyzeByChannel(state);
  return channels
    .filter(ch => parseFloat(ch.roi) < 0)
    .sort((a, b) => parseFloat(a.roi) - parseFloat(b.roi))
    .slice(0, 3);
}

// Сравнение креативов (для paid ads)
export function compareCreatives(state) {
  const paidExps = state.distributionExperiments.filter(e => 
    e.type === 'paid' && e.metrics.impressions > 0
  );
  
  return paidExps.map(exp => {
    const roi = calculateROI(exp);
    
    return {
      id: exp.id,
      name: exp.name,
      channel: exp.channel,
      impressions: exp.metrics.impressions,
      ctr: exp.metrics.ctr,
      hookRate: exp.metrics.hookRate,
      holdRate: exp.metrics.holdRate,
      conversionRate: exp.metrics.conversionRate,
      cpi: exp.metrics.cpi,
      roi: roi ? roi.roi : 'N/A',
      profitable: roi ? roi.profitable : false
    };
  }).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
}

// Viral Metrics Analysis (k-factor и shareRate)
export function analyzeViralMetrics(state) {
  const viralExps = state.distributionExperiments.filter(e => 
    e.type === 'viral' || e.channel === 'viral_loop'
  );
  
  if (viralExps.length === 0) {
    return {
      hasViralLoops: false,
      avgKFactor: 0,
      avgShareRate: 0,
      totalViralInstalls: 0
    };
  }
  
  const totalInstalls = viralExps.reduce((sum, e) => sum + e.metrics.installs, 0);
  const avgKFactor = viralExps.reduce((sum, e) => sum + e.metrics.kFactor, 0) / viralExps.length;
  const avgShareRate = viralExps.reduce((sum, e) => sum + e.metrics.shareRate, 0) / viralExps.length;
  
  return {
    hasViralLoops: true,
    avgKFactor: avgKFactor.toFixed(2),
    avgShareRate: avgShareRate.toFixed(1),
    totalViralInstalls,
    isViral: avgKFactor > 1 // k-factor > 1 = exponential growth
  };
}

// App Mafia Insights: какие гипотезы сработали
export function getDistributionInsights(state) {
  const exps = state.distributionExperiments.filter(e => e.status === 'completed');
  
  const allWorked = [];
  const allDidntWork = [];
  const allLearnings = [];
  
  exps.forEach(exp => {
    allWorked.push(...exp.results.whatWorked.map(item => ({
      text: item,
      channel: exp.channel,
      experimentName: exp.name
    })));
    
    allDidntWork.push(...exp.results.whatDidntWork.map(item => ({
      text: item,
      channel: exp.channel,
      experimentName: exp.name
    })));
    
    allLearnings.push(...exp.results.keyLearnings.map(item => ({
      text: item,
      channel: exp.channel,
      experimentName: exp.name
    })));
  });
  
  return {
    whatWorked: allWorked,
    whatDidntWork: allDidntWork,
    keyLearnings: allLearnings
  };
}

// Cohort Retention Analysis
export function analyzeCohortRetention(state) {
  const exps = state.distributionExperiments.filter(e => 
    e.metrics.installs > 0 && e.metrics.retentionR1 > 0
  );
  
  if (exps.length === 0) return null;
  
  // Группируем по каналам
  const cohorts = {};
  
  exps.forEach(exp => {
    if (!cohorts[exp.channel]) {
      cohorts[exp.channel] = {
        channel: exp.channel,
        installs: 0,
        r1: [],
        r7: [],
        r30: []
      };
    }
    
    const cohort = cohorts[exp.channel];
    cohort.installs += exp.metrics.installs;
    cohort.r1.push(exp.metrics.retentionR1);
    cohort.r7.push(exp.metrics.retentionR7);
    cohort.r30.push(exp.metrics.retentionR30);
  });
  
  // Вычисляем средние retention по каналам
  Object.values(cohorts).forEach(cohort => {
    cohort.avgR1 = (cohort.r1.reduce((a,b) => a+b, 0) / cohort.r1.length).toFixed(1);
    cohort.avgR7 = (cohort.r7.reduce((a,b) => a+b, 0) / cohort.r7.length).toFixed(1);
    cohort.avgR30 = (cohort.r30.reduce((a,b) => a+b, 0) / cohort.r30.length).toFixed(1);
    delete cohort.r1;
    delete cohort.r7;
    delete cohort.r30;
  });
  
  return Object.values(cohorts);
}

// Прогноз LTV на основе retention (App Mafia formula)
export function predictLTV(retentionR1, retentionR7, retentionR30, arpu) {
  // Упрощенная формула: LTV ≈ ARPU × (R1 + R7 + R30) / 3
  // В реальности формула сложнее, но для прототипа подойдет
  
  const avgRetention = (retentionR1 + retentionR7 + retentionR30) / 3 / 100;
  const predictedLTV = arpu / (1 - avgRetention);
  
  return predictedLTV.toFixed(2);
}
