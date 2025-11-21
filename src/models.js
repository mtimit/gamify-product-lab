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
    version: "1.0",
    gameProfile: {
      id: "user-001",
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      streakDays: 0,
      lastActivityDate: null, // ISO string (yyyy-mm-dd)
      achievements: [],
      totalRevenue: 0,
      timeSpent: {
        sessions: []
      }
    },
    projects: [],
    experiments: [],
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

  state.projects.push(project);
  return project;
}

export function updateProject(state, projectId, patch) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return null;

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
    source: event.source || "unknown"
  };
  state.eventLog.push(entry);
  return entry;
}
