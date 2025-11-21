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

  state.gameProfile.xp += amount;
  logEvent(state, { type: "xp_gain", value: amount, source });

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
  add_note: 5
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
}
