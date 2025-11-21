//Игровая логика: XP, уровни, streak, выдача ачивок, маппинг действий → XP.
// src/gameLogic.js

import { logEvent } from "./models.js";

// --- XP & level ---

export function calculateXpToNextLevel(level) {
  // простая формула роста
  return Math.round(100 * Math.pow(level, 1.3));
}

export function gainXp(state, amount, source = "unknown") {
  if (amount <= 0) return;

  // Применяем XP boost
  const boostedAmount = Math.round(amount * (state.gameProfile.xpBoost || 1.0));
  state.gameProfile.xp += boostedAmount;
  logEvent(state, { 
    type: "xp_gain", 
    value: boostedAmount, 
    source,
    metadata: { originalAmount: amount, boost: state.gameProfile.xpBoost }
  });

  // level up
  let leveledUp = false;
  while (state.gameProfile.xp >= state.gameProfile.xpToNextLevel) {
    state.gameProfile.xp -= state.gameProfile.xpToNextLevel;
    state.gameProfile.level += 1;
    state.gameProfile.xpToNextLevel = calculateXpToNextLevel(
      state.gameProfile.level
    );
    leveledUp = true;
  }

  if (leveledUp) {
    logEvent(state, {
      type: "level_up",
      value: state.gameProfile.level,
      source: "xp_threshold"
    });
  }
}

// --- Streak (по дням активности) ---

export function registerActivity(state) {
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const last = state.gameProfile.lastActivityDate;

  if (!last) {
    state.gameProfile.streakDays = 1;
  } else {
    const deltaDays = diffInDays(last, today);
    if (deltaDays === 1) {
      state.gameProfile.streakDays += 1;
    } else if (deltaDays > 1) {
      state.gameProfile.streakDays = 1; // сброс streak
    }
  }

  state.gameProfile.lastActivityDate = today;
  logEvent(state, { type: "activity", value: 1, source: "user_action" });
}

function diffInDays(dateStrA, dateStrB) {
  const a = new Date(dateStrA);
  const b = new Date(dateStrB);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((b - a) / msPerDay);
}

// --- Achievements ---

export function recomputeAchievements(state) {
  const profile = state.gameProfile;

  const totalRevenue = profile.totalRevenue;
  const projectsCount = state.projects.length;
  const launchedProjects = state.projects.filter(
    p => p.status === "launched"
  ).length;
  const completedExperiments = state.experiments.filter(
    e => e.status === "completed"
  ).length;

  // Growth metrics
  const distributionExperiments = state.distributionExperiments || [];
  const asoExperiments = distributionExperiments.filter(e => e.channel === 'aso');
  const paidExperiments = distributionExperiments.filter(e => e.type === 'paid');
  const totalInstalls = distributionExperiments.reduce((sum, e) => sum + (e.metrics.installs || 0), 0);
  const viralLoops = distributionExperiments.filter(e => e.channel === 'viral_loop');
  const profitableChannels = distributionExperiments.filter(e => {
    const revenue = e.metrics.installs * e.metrics.arpu;
    const roi = e.metrics.spent > 0 ? ((revenue - e.metrics.spent) / e.metrics.spent) * 100 : 0;
    return roi > 0 && e.status === 'completed';
  });

  const earnedIds = new Set(profile.achievements);

  state.achievements.forEach(ach => {
    if (ach.earnedAt) {
      earnedIds.add(ach.id);
      return;
    }

    let conditionMet = false;

    switch (ach.conditionType) {
      case "revenue_total":
        conditionMet = totalRevenue >= ach.thresholdValue;
        break;
      case "projects_count":
        conditionMet = projectsCount >= ach.thresholdValue;
        break;
      case "project_launched":
        conditionMet = launchedProjects >= ach.thresholdValue;
        break;
      case "experiments_completed":
        conditionMet = completedExperiments >= ach.thresholdValue;
        break;
      case "aso_test_completed":
        conditionMet = asoExperiments.length >= ach.thresholdValue;
        break;
      case "ad_creatives_tested":
        conditionMet = paidExperiments.length >= ach.thresholdValue;
        break;
      case "total_installs":
        conditionMet = totalInstalls >= ach.thresholdValue;
        break;
      case "viral_loop_launched":
        conditionMet = viralLoops.length >= ach.thresholdValue;
        break;
      case "profitable_channel":
        conditionMet = profitableChannels.length >= ach.thresholdValue;
        break;
      default:
        break;
    }

    if (conditionMet && !earnedIds.has(ach.id)) {
      ach.earnedAt = new Date().toISOString();
      profile.achievements.push(ach.id);
      earnedIds.add(ach.id);

      logEvent(state, {
        type: "achievement_unlocked",
        value: 1,
        source: ach.id
      });

      // бонусное XP за ачивку
      gainXp(state, 50, `achievement:${ach.id}`);
    }
  });
}

// --- Mapping действий на XP ---

const ACTION_XP_MAP = {
  create_project: 10,
  update_project_status: 20,
  complete_experiment: 50,
  add_revenue: 0, // отдельная формула
  add_note: 5,
  create_distribution_experiment: 30
};

export function awardXpForAction(state, action, payload = {}) {
  registerActivity(state);

  if (action === "add_revenue") {
    const amount = payload.amount || 0;
    if (amount > 0) {
      const xpFromRevenue = Math.round(amount / 10); // 1 XP за $10, настраивается
      gainXp(state, xpFromRevenue, "revenue");
    }
  } else {
    const baseXp = ACTION_XP_MAP[action] || 0;
    if (baseXp > 0) {
      gainXp(state, baseXp, action);
    }
  }

  // пересчёт ачивок на каждом значимом действии
  recomputeAchievements(state);
  
  // проверка прогресса квестов
  updateQuestsProgress(state, action, payload);
}

// --- Quests system ---

import { createQuest, completeQuest, updateQuest } from "./models.js";

// Автосоздание дефолтных квестов
export function initializeDefaultQuests(state) {
  // Проверяем, есть ли уже квесты
  if (state.quests && state.quests.length > 0) return;
  
  // Создаём стартовые квесты
  const defaultQuests = [
    {
      title: "Первый эксперимент",
      description: "Запусти один новый эксперимент за 48 часов",
      type: "timed",
      targetProgress: 1,
      reward: { xp: 100, xpBoost: 0 },
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      conditions: { action: "create_experiment", count: 1 }
    },
    {
      title: "Путь к запуску",
      description: "Доведи проект до стадии launched за неделю",
      type: "timed",
      targetProgress: 1,
      reward: { xp: 200, xpBoost: 0.1 },
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      conditions: { action: "project_launched", count: 1 }
    },
    {
      title: "Генератор идей",
      description: "Создай 3 новых проекта",
      type: "milestone",
      targetProgress: 3,
      reward: { xp: 150, xpBoost: 0 },
      deadline: null,
      conditions: { action: "create_project", count: 3 }
    }
  ];
  
  defaultQuests.forEach(quest => createQuest(state, quest));
}

// Обновление прогресса квестов
export function updateQuestsProgress(state, action, payload = {}) {
  if (!state.quests) return;
  
  const now = Date.now();
  
  state.quests.forEach(quest => {
    if (quest.status !== "active") return;
    
    // Проверка срока действия
    if (quest.deadline) {
      const deadline = new Date(quest.deadline).getTime();
      if (now > deadline) {
        quest.status = "expired";
        quest.updatedAt = new Date().toISOString();
        logEvent(state, {
          type: "quest_expired",
          value: 0,
          source: quest.id,
          metadata: { questTitle: quest.title }
        });
        return;
      }
    }
    
    // Проверка условий квеста
    const conditions = quest.conditions;
    let progressIncreased = false;
    
    if (conditions.action === action || 
        (conditions.action === "project_launched" && action === "update_project_status" && payload.newStatus === "launched")) {
      quest.progress += 1;
      progressIncreased = true;
      updateQuest(state, quest.id, { progress: quest.progress });
      
      logEvent(state, {
        type: "quest_progress",
        value: quest.progress,
        source: quest.id,
        metadata: { 
          questTitle: quest.title,
          progress: quest.progress,
          target: quest.targetProgress
        }
      });
    }
    
    // Проверка завершения
    if (quest.progress >= quest.targetProgress) {
      completeQuest(state, quest.id);
      
      // Выдаём награду
      if (quest.reward.xp > 0) {
        gainXp(state, quest.reward.xp, `quest:${quest.id}`);
      }
      if (quest.reward.xpBoost > 0) {
        state.gameProfile.xpBoost = (state.gameProfile.xpBoost || 1.0) + quest.reward.xpBoost;
        logEvent(state, {
          type: "xp_boost_gained",
          value: quest.reward.xpBoost,
          source: quest.id,
          metadata: { newBoost: state.gameProfile.xpBoost }
        });
      }
    }
  });
}
