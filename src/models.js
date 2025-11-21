// src/models.js
// Базовые модели + простые CRUD-операции и лог событий.
// --- ID helper ---
let _idCounter = 1;
export function generateId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;
}

// --- Initial state ---

export function createInitialState() {
  const now = new Date().toISOString();

  return {
    version: "2.0",
    gameProfile: {
      id: "user-001",
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      streakDays: 0,
      lastActivityDate: null, // ISO string (yyyy-mm-dd)
      achievements: [],
      totalRevenue: 0,
      xpBoost: 1.0, // множитель XP (для наград)
      timeSpent: {
        sessions: []
      }
    },
    projects: [],
    experiments: [],
    distributionExperiments: [], // v2.0: эксперименты по дистрибуции
    quests: [], // активные и завершенные квесты
    achievements: [
      {
        id: "first-dollar",
        name: "Первый выстрел",
        description: "Получил первый доллар дохода",
        conditionType: "revenue_total",
        thresholdValue: 1,
        earnedAt: null
      },
      {
        id: "five-ideas",
        name: "Марафон идей",
        description: "Создал минимум 5 проектов-идей",
        conditionType: "projects_count",
        thresholdValue: 5,
        earnedAt: null
      },
      {
        id: "first-launch",
        name: "Первый релиз",
        description: "Перевёл первый проект в статус launched",
        conditionType: "project_launched",
        thresholdValue: 1,
        earnedAt: null
      },
      {
        id: "experimenter",
        name: "Учёный-экспериментатор",
        description: "Завершил минимум 3 эксперимента",
        conditionType: "experiments_completed",
        thresholdValue: 3,
        earnedAt: null
      },
      // v2.0: Growth & Distribution Achievements
      {
        id: "aso-master",
        name: "ASO Мастер",
        description: "Провёл первый ASO-тест",
        conditionType: "aso_test_completed",
        thresholdValue: 1,
        earnedAt: null
      },
      {
        id: "creative-machine",
        name: "Генератор креативов",
        description: "Протестировал 5 рекламных креативов",
        conditionType: "ad_creatives_tested",
        thresholdValue: 5,
        earnedAt: null
      },
      {
        id: "first-hundred",
        name: "Первая сотня",
        description: "Получил 100 установок",
        conditionType: "total_installs",
        thresholdValue: 100,
        earnedAt: null
      },
      {
        id: "viral-architect",
        name: "Вирусный архитектор",
        description: "Запустил viral loop механику",
        conditionType: "viral_loop_launched",
        thresholdValue: 1,
        earnedAt: null
      },
      {
        id: "profitable-channel",
        name: "Прибыльный канал",
        description: "Создал канал дистрибуции с положительным ROI",
        conditionType: "profitable_channel",
        thresholdValue: 1,
        earnedAt: null
      }
    ],
    eventLog: [
      {
        id: generateId("ev"),
        timestamp: now,
        type: "system_init",
        value: 0,
        source: "system"
      }
    ]
  };
}

// --- Projects ---

export function createProject(state, data) {
  const now = new Date().toISOString();
  const project = {
    id: generateId("p"),
    name: data.name || "New Project",
    status: data.status || "idea", // idea | validating | designing | building | launched | scaling | archived
    createdAt: now,
    updatedAt: now,
    tags: data.tags || [],
    targetAudience: data.targetAudience || "",
    problem: data.problem || "",
    solutionHypothesis: data.solutionHypothesis || "",
    distributionChannels: data.distributionChannels || [],
    // v1.3: Расширенная аналитика
    hypotheses: [], // список гипотез { id, text, validated, result }
    insights: {
      whatWorked: [], // что сработало
      whatDidntWork: [], // что не сработало
      keyLearnings: [] // ключевые выводы
    },
    stageHistory: [
      { stage: "idea", enteredAt: now, exitedAt: null }
    ], // история переходов по стадиям
    // Рейтинг идеи
    ideaScore: {
      problemValue: data.problemValue || 5, // 1-10: насколько ценно решение проблемы
      scalability: data.scalability || 5, // 1-10: насколько масштабируемо
      developmentTime: data.developmentTime || 5, // 1-10: скорость разработки (10=быстро)
      totalScore: 0 // вычисляется автоматически
    },
    metrics: {
      installs: 0,
      mau: 0,
      wau: 0,
      dau: 0,
      revenueTotal: 0,
      revenueMonthly: 0,
      conversionRate: null
    },
    experiments: [],
    notes: []
  };

  // Вычисляем начальный score
  project.ideaScore.totalScore = calculateIdeaScore(project.ideaScore);

  state.projects.push(project);
  return project;
}

// Вычисление рейтинга идеи
function calculateIdeaScore(scoreData) {
  const { problemValue, scalability, developmentTime } = scoreData;
  // Формула: среднее взвешенное
  // problemValue имеет больший вес (40%), scalability (35%), developmentTime (25%)
  return ((problemValue * 0.4) + (scalability * 0.35) + (developmentTime * 0.25)).toFixed(2);
}

export function updateProject(state, projectId, patch) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  // Если меняем статус - отслеживаем переход
  if (patch.status && patch.status !== project.status) {
    trackStageChange(state, projectId, patch.status);
  }

  Object.assign(project, patch);
  project.updatedAt = new Date().toISOString();
  return project;
}

export function addProjectNote(state, projectId, text) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  const note = {
    date: new Date().toISOString(),
    text
  };
  project.notes.push(note);
  project.updatedAt = note.date;
  return note;
}

export function updateProjectRevenue(state, projectId, deltaRevenue) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  project.metrics.revenueTotal += deltaRevenue;
  project.metrics.revenueMonthly += deltaRevenue;
  project.updatedAt = new Date().toISOString();

  state.gameProfile.totalRevenue += deltaRevenue;

  return project;
}

// --- Experiments ---

export function createExperiment(state, data) {
  const now = new Date().toISOString();
  const experiment = {
    id: generateId("e"),
    projectId: data.projectId,
    type: data.type || "generic",
    status: data.status || "planned", // planned | running | completed | canceled
    hypothesis: data.hypothesis || "",
    metricTarget: data.metricTarget || {},
    result: data.result || {},
    xpReward: data.xpReward || 0,
    startedAt: data.startedAt || now,
    endedAt: data.endedAt || null
  };

  state.experiments.push(experiment);
  const project = state.projects.find(p => p.id === experiment.projectId);
  if (project) {
    project.experiments.push(experiment.id);
    project.updatedAt = now;
  }

  return experiment;
}

export function updateExperiment(state, experimentId, patch) {
  const experiment = state.experiments.find(e => e.id === experimentId);
  if (!experiment) return null;

  Object.assign(experiment, patch);
  if (patch.status === "completed" && !experiment.endedAt) {
    experiment.endedAt = new Date().toISOString();
  }
  return experiment;
}

// --- Event log ---

export function logEvent(state, event) {
  const entry = {
    id: generateId("ev"),
    timestamp: new Date().toISOString(),
    type: event.type,
    value: event.value || 0,
    source: event.source || "unknown",
    metadata: event.metadata || {}
  };
  state.eventLog.push(entry);
  
  // Ограничиваем размер лога до последних 100 событий
  if (state.eventLog.length > 100) {
    state.eventLog = state.eventLog.slice(-100);
  }
  
  return entry;
}

// --- Quests ---

export function createQuest(state, data) {
  const now = new Date().toISOString();
  const quest = {
    id: generateId("q"),
    title: data.title,
    description: data.description,
    type: data.type || "generic", // generic | timed | milestone
    status: "active", // active | completed | failed | expired
    progress: 0,
    targetProgress: data.targetProgress || 1,
    reward: data.reward || { xp: 0, xpBoost: 0 },
    deadline: data.deadline || null, // ISO timestamp или null
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    conditions: data.conditions || {} // условия для проверки
  };
  
  state.quests.push(quest);
  logEvent(state, { 
    type: "quest_started", 
    value: 1, 
    source: quest.id,
    metadata: { questTitle: quest.title }
  });
  
  return quest;
}

export function updateQuest(state, questId, patch) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return null;
  
  Object.assign(quest, patch);
  quest.updatedAt = new Date().toISOString();
  
  return quest;
}

export function completeQuest(state, questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest || quest.status !== "active") return null;
  
  quest.status = "completed";
  quest.completedAt = new Date().toISOString();
  quest.updatedAt = quest.completedAt;
  
  logEvent(state, {
    type: "quest_completed",
    value: 1,
    source: quest.id,
    metadata: { questTitle: quest.title, reward: quest.reward }
  });
  
  return quest;
}

// --- v1.3: Project Analytics ---

// Добавить гипотезу
export function addHypothesis(state, projectId, text) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  const hypothesis = {
    id: generateId("hyp"),
    text,
    validated: false,
    result: null, // "success" | "failure" | null
    createdAt: new Date().toISOString()
  };

  project.hypotheses.push(hypothesis);
  project.updatedAt = new Date().toISOString();
  
  return hypothesis;
}

// Валидировать гипотезу
export function validateHypothesis(state, projectId, hypothesisId, result) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  const hypothesis = project.hypotheses.find(h => h.id === hypothesisId);
  if (!hypothesis) return null;

  hypothesis.validated = true;
  hypothesis.result = result;
  hypothesis.validatedAt = new Date().toISOString();
  project.updatedAt = hypothesis.validatedAt;

  return hypothesis;
}

// Добавить insight (что сработало/не сработало)
export function addInsight(state, projectId, type, text) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  const insight = {
    id: generateId("ins"),
    text,
    createdAt: new Date().toISOString()
  };

  if (type === "worked") {
    project.insights.whatWorked.push(insight);
  } else if (type === "didnt-work") {
    project.insights.whatDidntWork.push(insight);
  } else if (type === "learning") {
    project.insights.keyLearnings.push(insight);
  }

  project.updatedAt = new Date().toISOString();
  
  return insight;
}

// Обновить score проекта
export function updateIdeaScore(state, projectId, scoreData) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  Object.assign(project.ideaScore, scoreData);
  project.ideaScore.totalScore = calculateIdeaScore(project.ideaScore);
  project.updatedAt = new Date().toISOString();

  return project;
}

// Отследить переход по стадиям
export function trackStageChange(state, projectId, newStage) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  
  // Закрываем текущую стадию
  const currentStage = project.stageHistory[project.stageHistory.length - 1];
  if (currentStage && !currentStage.exitedAt) {
    currentStage.exitedAt = now;
  }

  // Добавляем новую стадию
  project.stageHistory.push({
    stage: newStage,
    enteredAt: now,
    exitedAt: null
  });

  return project;
}

// --- v2.0: Distribution Experiments ---

export function createDistributionExperiment(state, data) {
  const now = new Date().toISOString();
  
  const experiment = {
    id: generateId("dist"),
    projectId: data.projectId || null,
    name: data.name || "New Distribution Experiment",
    channel: data.channel || "organic", // organic, influencer, ppc, aso, viral_loop, reddit, tiktok_ads
    type: data.type || "content", // content, paid, aso, viral
    status: data.status || "planning", // planning, running, completed, paused, failed
    
    // Метрики по App Mafia
    metrics: {
      // Cost metrics
      budget: data.budget || 0, // Общий бюджет
      spent: data.spent || 0, // Потрачено
      cpi: data.cpi || 0, // Cost Per Install
      cpm: data.cpm || 0, // Cost Per Mille (1000 impressions)
      cpr: data.cpr || 0, // Cost Per Result (custom conversion)
      
      // Acquisition metrics
      installs: data.installs || 0, // Количество установок
      impressions: data.impressions || 0, // Показы
      clicks: data.clicks || 0, // Клики
      conversionRate: data.conversionRate || 0, // % кликов → установки
      
      // Retention metrics (Day 1, 7, 30)
      retentionR1: data.retentionR1 || 0, // % пользователей вернулись на день 1
      retentionR7: data.retentionR7 || 0, // % пользователей вернулись на день 7
      retentionR30: data.retentionR30 || 0, // % пользователей вернулись на день 30
      
      // Revenue metrics
      arpu: data.arpu || 0, // Average Revenue Per User
      ltv: data.ltv || 0, // Lifetime Value
      rpm: data.rpm || 0, // Revenue Per Mille (1000 impressions)
      
      // Virality metrics
      kFactor: data.kFactor || 0, // Viral coefficient (сколько новых юзеров приводит 1 юзер)
      shareRate: data.shareRate || 0, // % пользователей поделились
      
      // Creative performance (для paid ads)
      hookRate: data.hookRate || 0, // % stopped scrolling
      holdRate: data.holdRate || 0, // % watched till end
      ctr: data.ctr || 0, // Click Through Rate
    },
    
    // Детали эксперимента
    description: data.description || "",
    hypothesis: data.hypothesis || "", // Что мы тестируем
    creative: data.creative || "", // Описание креатива/подхода
    targetAudience: data.targetAudience || "", // Целевая аудитория
    
    // Инсайты (App Mafia-style)
    results: {
      whatWorked: [], // Что сработало
      whatDidntWork: [], // Что не сработало
      keyLearnings: [], // Ключевые выводы
      nextSteps: [] // Следующие шаги
    },
    
    // Временные метки
    startDate: data.startDate || now,
    endDate: data.endDate || null,
    createdAt: now,
    updatedAt: now,
    
    // Теги для фильтрации
    tags: data.tags || []
  };
  
  state.distributionExperiments.push(experiment);
  return experiment;
}

export function updateDistributionExperiment(state, experimentId, patch) {
  const exp = state.distributionExperiments.find(e => e.id === experimentId);
  if (!exp) return null;
  
  Object.assign(exp, patch);
  exp.updatedAt = new Date().toISOString();
  
  // Автоматически рассчитываем производные метрики
  if (exp.metrics.budget > 0 && exp.metrics.installs > 0) {
    exp.metrics.cpi = (exp.metrics.spent / exp.metrics.installs).toFixed(2);
  }
  
  if (exp.metrics.impressions > 0) {
    exp.metrics.cpm = ((exp.metrics.spent / exp.metrics.impressions) * 1000).toFixed(2);
  }
  
  if (exp.metrics.clicks > 0 && exp.metrics.impressions > 0) {
    exp.metrics.ctr = ((exp.metrics.clicks / exp.metrics.impressions) * 100).toFixed(2);
  }
  
  if (exp.metrics.installs > 0 && exp.metrics.clicks > 0) {
    exp.metrics.conversionRate = ((exp.metrics.installs / exp.metrics.clicks) * 100).toFixed(2);
  }
  
  return exp;
}

export function addDistributionInsight(state, experimentId, type, text) {
  const exp = state.distributionExperiments.find(e => e.id === experimentId);
  if (!exp) return null;
  
  const validTypes = ['whatWorked', 'whatDidntWork', 'keyLearnings', 'nextSteps'];
  if (!validTypes.includes(type)) return null;
  
  exp.results[type].push(text);
  exp.updatedAt = new Date().toISOString();
  
  return exp;
}
