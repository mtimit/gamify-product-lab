// src/analytics.js
// Вычисление аналитических метрик для проектов

// Скорость прохождения стадий (в днях)
export function calculateStageVelocity(project) {
  const velocities = {};
  
  project.stageHistory.forEach((stage, index) => {
    if (stage.exitedAt) {
      const enteredAt = new Date(stage.enteredAt);
      const exitedAt = new Date(stage.exitedAt);
      const daysInStage = (exitedAt - enteredAt) / (1000 * 60 * 60 * 24);
      
      velocities[stage.stage] = Math.round(daysInStage * 10) / 10; // округляем до 0.1
    }
  });
  
  return velocities;
}

// Среднее время разработки MVP (от idea до building/launched)
export function calculateMVPTime(project) {
  const ideaStage = project.stageHistory.find(s => s.stage === "idea");
  const mvpStages = project.stageHistory.filter(s => 
    s.stage === "building" || s.stage === "launched"
  );
  
  if (!ideaStage || mvpStages.length === 0) return null;
  
  const firstMVP = mvpStages[0];
  const startDate = new Date(ideaStage.enteredAt);
  const mvpDate = new Date(firstMVP.enteredAt);
  
  const daysToMVP = (mvpDate - startDate) / (1000 * 60 * 60 * 24);
  return Math.round(daysToMVP * 10) / 10;
}

// Количество экспериментов в неделю
export function calculateExperimentsPerWeek(state) {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  
  const recentExperiments = state.experiments.filter(exp => {
    const createdAt = new Date(exp.startedAt);
    return createdAt >= weekAgo;
  });
  
  return recentExperiments.length;
}

// Общая статистика по всем проектам
export function calculateOverallMetrics(state) {
  const metrics = {
    totalProjects: state.projects.length,
    activeProjects: state.projects.filter(p => 
      p.status !== "archived" && p.status !== "idea"
    ).length,
    launchedProjects: state.projects.filter(p => 
      p.status === "launched" || p.status === "scaling"
    ).length,
    totalExperiments: state.experiments.length,
    completedExperiments: state.experiments.filter(e => 
      e.status === "completed"
    ).length,
    avgExperimentsPerProject: 0,
    avgMVPTime: 0,
    experimentsPerWeek: calculateExperimentsPerWeek(state),
    topRatedIdeas: []
  };
  
  // Средневремя до MVP по всем проектам
  const mvpTimes = state.projects
    .map(p => calculateMVPTime(p))
    .filter(t => t !== null);
    
  if (mvpTimes.length > 0) {
    metrics.avgMVPTime = (mvpTimes.reduce((a, b) => a + b, 0) / mvpTimes.length).toFixed(1);
  }
  
  // Среднее количество экспериментов на проект
  if (state.projects.length > 0) {
    metrics.avgExperimentsPerProject = (state.experiments.length / state.projects.length).toFixed(1);
  }
  
  // Топ 5 идей по рейтингу
  metrics.topRatedIdeas = state.projects
    .filter(p => p.status === "idea")
    .sort((a, b) => b.ideaScore.totalScore - a.ideaScore.totalScore)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.name,
      score: p.ideaScore.totalScore
    }));
  
  return metrics;
}

// Карта экспериментов проекта (визуализация)
export function getExperimentsMap(state, projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;
  
  const experiments = state.experiments.filter(e => e.projectId === projectId);
  
  return {
    total: experiments.length,
    byStatus: {
      planned: experiments.filter(e => e.status === "planned").length,
      running: experiments.filter(e => e.status === "running").length,
      completed: experiments.filter(e => e.status === "completed").length,
      canceled: experiments.filter(e => e.status === "canceled").length
    },
    byType: experiments.reduce((acc, exp) => {
      acc[exp.type] = (acc[exp.type] || 0) + 1;
      return acc;
    }, {}),
    successRate: experiments.length > 0
      ? ((experiments.filter(e => e.status === "completed").length / experiments.length) * 100).toFixed(1)
      : 0
  };
}

// Получить детальный отчет по проекту
export function getProjectReport(state, projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;
  
  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
      ideaScore: project.ideaScore
    },
    timeline: {
      stageVelocity: calculateStageVelocity(project),
      mvpTime: calculateMVPTime(project),
      totalDays: Math.round((new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24))
    },
    hypotheses: {
      total: project.hypotheses.length,
      validated: project.hypotheses.filter(h => h.validated).length,
      successful: project.hypotheses.filter(h => h.result === "success").length,
      failed: project.hypotheses.filter(h => h.result === "failure").length
    },
    experiments: getExperimentsMap(state, projectId),
    insights: {
      whatWorked: project.insights.whatWorked.length,
      whatDidntWork: project.insights.whatDidntWork.length,
      keyLearnings: project.insights.keyLearnings.length
    },
    metrics: project.metrics
  };
}

// Сравнение проектов
export function compareProjects(state, projectIds) {
  return projectIds.map(id => {
    const project = state.projects.find(p => p.id === id);
    if (!project) return null;
    
    return {
      id: project.id,
      name: project.name,
      score: project.ideaScore.totalScore,
      mvpTime: calculateMVPTime(project),
      experiments: state.experiments.filter(e => e.projectId === id).length,
      revenue: project.metrics.revenueTotal
    };
  }).filter(p => p !== null);
}
