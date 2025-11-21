// app.js
// Простейший прототип: 3 экрана, проекты, эксперименты, доход, XP/уровни.

import {
  createProject,
  updateProject,
  updateProjectRevenue,
  createExperiment,
  updateExperiment,
  createQuest,
  completeQuest
} from "./models.js";
import { loadState, saveState } from "./storage.js";
import { awardXpForAction, initializeDefaultQuests } from "./gameLogic.js";
import { renderXpChart, renderRevenueChart, renderProgressBar } from "./charts.js";

let state = null;
let currentProjectFilter = "";
let currentQuestFilter = "active";

// --- Init ---

function init() {
  try {
    console.log("Инициализация приложения...");
    state = loadState();
    console.log("State загружен:", state);
    normalizeState();
    setupTabs();
    setupEventHandlers();
    renderAll();
    console.log("Приложение готово к работе!");
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
  }
}

window.addEventListener("DOMContentLoaded", init);

// --- Helpers ---

function $(selector) {
  return document.querySelector(selector);
}

function normalizeState() {
  if (!state.projects) state.projects = [];
  if (!state.experiments) state.experiments = [];
  if (!state.achievements) state.achievements = [];
  if (!state.quests) state.quests = [];
  if (!state.gameProfile.xpBoost) state.gameProfile.xpBoost = 1.0;
  
  // Инициализируем дефолтные квесты если их нет
  initializeDefaultQuests(state);
}

// --- Tabs (экраны) ---

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  console.log("Найдено кнопок табов:", buttons.length);
  
  buttons.forEach(btn => {
    console.log("Настройка таба:", btn.dataset.screen);
    btn.addEventListener("click", (e) => {
      console.log("Клик по табу:", btn.dataset.screen);
      const target = btn.dataset.screen;

      // активная кнопка
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // активный экран
      document.querySelectorAll(".screen").forEach(scr => {
        scr.classList.remove("active");
      });
      const screenEl = document.getElementById(`screen-${target}`);
      console.log("Переключение на экран:", `screen-${target}`, screenEl);
      if (screenEl) {
        screenEl.classList.add("active");
      }
    });
  });
}

// --- Rendering ---

function renderAll() {
  renderDashboard();
  renderProjects();
  renderExperiments();
  renderQuests();
  updateProjectSelects();
}

function renderDashboard() {
  const gp = state.gameProfile;

  $("#level").textContent = gp.level;
  $("#xp").textContent = gp.xp;
  $("#xpToNext").textContent = gp.xpToNextLevel;
  $("#xpBoost").textContent = `${gp.xpBoost.toFixed(1)}x`;
  $("#streak").textContent = gp.streakDays;
  $("#totalRevenue").textContent = gp.totalRevenue.toFixed(2);

  // Графики
  const xpChartEl = $("#xpChart");
  if (xpChartEl) {
    xpChartEl.innerHTML = renderXpChart(state.eventLog || []);
  }

  const revenueChartEl = $("#revenueChart");
  if (revenueChartEl) {
    revenueChartEl.innerHTML = renderRevenueChart(state.eventLog || []);
  }

  // Active Quests Preview
  renderActiveQuestsPreview();

  // Achievements
  const achievementsList = $("#achievementsList");
  achievementsList.innerHTML = "";

  state.achievements.forEach(ach => {
    const li = document.createElement("li");
    li.textContent = ach.earnedAt ? `✅ ${ach.name}` : `⬜ ${ach.name}`;
    achievementsList.appendChild(li);
  });

  // Event Log
  renderEventLog();
}

function renderActiveQuestsPreview() {
  const container = $("#activeQuestsPreview");
  if (!container) return;

  container.innerHTML = "";
  const activeQuests = state.quests.filter(q => q.status === "active").slice(0, 3);

  if (!activeQuests.length) {
    container.innerHTML = "<p>Нет активных квестов</p>";
    return;
  }

  activeQuests.forEach(quest => {
    const card = document.createElement("div");
    card.className = "quest-card-mini";
    
    const title = document.createElement("div");
    title.className = "quest-title";
    title.textContent = quest.title;
    card.appendChild(title);

    const progressBar = document.createElement("div");
    progressBar.innerHTML = renderProgressBar(quest.progress, quest.targetProgress, 150);
    card.appendChild(progressBar);

    card.addEventListener("click", () => {
      // Переключаемся на вкладку Quests
      document.querySelector('[data-screen="quests"]').click();
    });

    container.appendChild(card);
  });
}

function renderEventLog() {
  const container = $("#eventLogList");
  if (!container) return;

  container.innerHTML = "";
  const recentEvents = state.eventLog.slice(-10).reverse();

  if (!recentEvents.length) {
    container.innerHTML = "<p>Пока нет событий</p>";
    return;
  }

  recentEvents.forEach(event => {
    const item = document.createElement("div");
    item.className = "event-item";

    const icon = getEventIcon(event.type);
    const text = getEventText(event);
    const time = new Date(event.timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });

    item.innerHTML = `
      <span class="event-icon">${icon}</span>
      <span class="event-text">${text}</span>
      <span class="event-time">${time}</span>
    `;

    container.appendChild(item);
  });
}

function getEventIcon(type) {
  const icons = {
    xp_gain: "⭐",
    level_up: "🎉",
    quest_started: "🎯",
    quest_completed: "✅",
    quest_progress: "📈",
    achievement_unlocked: "🏆",
    activity: "👤"
  };
  return icons[type] || "📝";
}

function getEventText(event) {
  switch (event.type) {
    case "xp_gain":
      return `+${event.value} XP (${event.source})`;
    case "level_up":
      return `Новый уровень: ${event.value}!`;
    case "quest_started":
      return `Новый квест: ${event.metadata?.questTitle || "квест"}`;
    case "quest_completed":
      return `Квест завершен: ${event.metadata?.questTitle || "квест"}`;
    case "quest_progress":
      return `Прогресс: ${event.metadata?.questTitle} (${event.metadata?.progress}/${event.metadata?.target})`;
    case "achievement_unlocked":
      return `Достижение разблокировано!`;
    case "activity":
      return `Активность зарегистрирована`;
    default:
      return event.type;
  }
}

function renderProjects() {
  const container = $("#projectsList");
  container.innerHTML = "";

  if (!state.projects.length) {
    container.textContent = "Пока нет проектов. Добавь первую идею!";
    return;
  }

  // Фильтруем проекты
  let filteredProjects = state.projects;
  if (currentProjectFilter) {
    filteredProjects = state.projects.filter(p => p.status === currentProjectFilter);
  }

  if (!filteredProjects.length) {
    container.textContent = "Нет проектов с таким фильтром.";
    return;
  }

  filteredProjects.forEach(project => {
    const div = document.createElement("div");
    div.className = "project-card";

    const header = document.createElement("div");
    header.className = "project-header";
    header.textContent = project.name;
    div.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "project-meta";
    meta.innerHTML = `<span>Статус:</span>`;
    div.appendChild(meta);

    const statusSelect = document.createElement("select");
    ["idea", "validating", "designing", "building", "launched", "scaling", "archived"].forEach(st => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      if (project.status === st) opt.selected = true;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener("change", () => {
      const oldStatus = project.status;
      const newStatus = statusSelect.value;
      updateProject(state, project.id, { status: newStatus });
      if (oldStatus !== newStatus) {
        awardXpForAction(state, "update_project_status", { oldStatus, newStatus });
        saveState(state);
        renderAll();
      }
    });

    meta.appendChild(statusSelect);

    const revenueDiv = document.createElement("div");
    revenueDiv.className = "project-revenue";
    revenueDiv.textContent = `Доход: ${project.metrics.revenueTotal.toFixed(2)}`;
    div.appendChild(revenueDiv);

    container.appendChild(div);
  });
}

function renderExperiments() {
  const container = $("#experimentsList");
  container.innerHTML = "";

  if (!state.experiments.length) {
    container.textContent = "Экспериментов пока нет. Создай первый!";
    return;
  }

  state.experiments.forEach(exp => {
    const project = state.projects.find(p => p.id === exp.projectId);
    const projectName = project ? project.name : "Неизвестный проект";

    const card = document.createElement("div");
    card.className = "experiment-card";

    const header = document.createElement("div");
    header.className = "experiment-header";
    header.textContent = `${projectName} — ${exp.type}`;
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "experiment-meta";
    meta.innerHTML = `<div>Гипотеза: ${exp.hypothesis || "—"}</div><span>Статус:</span>`;
    card.appendChild(meta);

    const statusSelect = document.createElement("select");
    ["planned", "running", "completed", "canceled"].forEach(st => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      if (exp.status === st) opt.selected = true;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener("change", () => {
      const oldStatus = exp.status;
      updateExperiment(state, exp.id, { status: statusSelect.value });
      if (oldStatus !== "completed" && statusSelect.value === "completed") {
        // завершили эксперимент => XP
        awardXpForAction(state, "complete_experiment");
      }
      saveState(state);
      renderDashboard();
      renderExperiments();
    });

    meta.appendChild(statusSelect);

    container.appendChild(card);
  });
}

function updateProjectSelects() {
  const revenueSelect = $("#revenueProject");
  const experimentSelect = $("#experimentProject");

  if (revenueSelect) {
    revenueSelect.innerHTML = "";
    state.projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      revenueSelect.appendChild(opt);
    });
  }

  if (experimentSelect) {
    const prevValue = experimentSelect.value;
    experimentSelect.innerHTML = '<option value="">Выбери проект</option>';
    state.projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      experimentSelect.appendChild(opt);
    });
    if (prevValue) {
      experimentSelect.value = prevValue;
    }
  }
}

function renderQuests() {
  const container = $("#questsList");
  if (!container) return;

  container.innerHTML = "";

  // Фильтруем квесты
  let filteredQuests = state.quests;
  if (currentQuestFilter === "active") {
    filteredQuests = state.quests.filter(q => q.status === "active");
  } else if (currentQuestFilter === "completed") {
    filteredQuests = state.quests.filter(q => q.status === "completed");
  }

  if (!filteredQuests.length) {
    container.innerHTML = "<p>Нет квестов</p>";
    return;
  }

  filteredQuests.forEach(quest => {
    const card = document.createElement("div");
    card.className = `quest-card quest-${quest.status}`;

    // Header
    const header = document.createElement("div");
    header.className = "quest-header";
    
    const title = document.createElement("h4");
    title.textContent = quest.title;
    header.appendChild(title);

    const typeBadge = document.createElement("span");
    typeBadge.className = `quest-badge quest-${quest.type}`;
    typeBadge.textContent = quest.type === "timed" ? "⏰ Временный" : "📊 Milestone";
    header.appendChild(typeBadge);

    card.appendChild(header);

    // Description
    const desc = document.createElement("p");
    desc.className = "quest-description";
    desc.textContent = quest.description;
    card.appendChild(desc);

    // Progress bar
    const progressDiv = document.createElement("div");
    progressDiv.innerHTML = renderProgressBar(quest.progress, quest.targetProgress);
    card.appendChild(progressDiv);

    // Deadline (если есть)
    if (quest.deadline && quest.status === "active") {
      const deadlineDiv = document.createElement("div");
      deadlineDiv.className = "quest-deadline";
      const deadline = new Date(quest.deadline);
      const now = new Date();
      const hoursLeft = Math.round((deadline - now) / (1000 * 60 * 60));
      
      if (hoursLeft > 0) {
        deadlineDiv.textContent = `⏰ Осталось: ${hoursLeft}ч`;
      } else {
        deadlineDiv.textContent = "⏰ Просрочен";
        deadlineDiv.style.color = "#ef4444";
      }
      card.appendChild(deadlineDiv);
    }

    // Reward
    const rewardDiv = document.createElement("div");
    rewardDiv.className = "quest-reward";
    let rewardText = "";
    if (quest.reward.xp > 0) {
      rewardText += `🎁 ${quest.reward.xp} XP`;
    }
    if (quest.reward.xpBoost > 0) {
      rewardText += ` +${(quest.reward.xpBoost * 100).toFixed(0)}% XP boost`;
    }
    rewardDiv.textContent = rewardText;
    card.appendChild(rewardDiv);

    // Status
    if (quest.status === "completed") {
      const completedDiv = document.createElement("div");
      completedDiv.className = "quest-completed";
      completedDiv.textContent = "✅ Завершен";
      card.appendChild(completedDiv);
    }

    container.appendChild(card);
  });
}

// --- Event handlers ---

function setupEventHandlers() {
  console.log("Настройка обработчиков событий...");
  
  // формы
  const projectForm = $("#projectForm");
  if (projectForm) {
    console.log("Форма проектов найдена");
    projectForm.addEventListener("submit", e => {
      e.preventDefault();
      console.log("Отправка формы проекта");
      const nameInput = $("#projectName");
      const name = nameInput.value.trim();
      if (!name) return;

      createProject(state, { name });
      awardXpForAction(state, "create_project");
      saveState(state);

      nameInput.value = "";
      renderAll();
      console.log("Проект создан!");
    });
  } else {
    console.warn("Форма проектов НЕ найдена!");
  }

  const revenueForm = $("#revenueForm");
  if (revenueForm) {
    revenueForm.addEventListener("submit", e => {
      e.preventDefault();
      if (!state.projects.length) {
        alert("Нет проектов для обновления дохода.");
        return;
      }

      const amountInput = $("#revenueAmount");
      const amount = parseFloat(amountInput.value.replace(",", "."));
      if (isNaN(amount) || amount <= 0) return;

      const projectIdSelect = $("#revenueProject");
      const projectId = projectIdSelect.value;

      updateProjectRevenue(state, projectId, amount);
      awardXpForAction(state, "add_revenue", { amount });
      saveState(state);

      amountInput.value = "";
      renderAll();
    });
  }

  const experimentForm = $("#experimentForm");
  if (experimentForm) {
    experimentForm.addEventListener("submit", e => {
      e.preventDefault();
      if (!state.projects.length) {
        alert("Сначала создай проект.");
        return;
      }

      const projectSelect = $("#experimentProject");
      const typeSelect = $("#experimentType");
      const hypoInput = $("#experimentHypothesis");

      const projectId = projectSelect.value;
      if (!projectId) return;

      const type = typeSelect.value || "generic";
      const hypothesis = hypoInput.value.trim();

      createExperiment(state, {
        projectId,
        type,
        hypothesis
      });

      // создание эксперимента пока XP не даёт, XP за завершение
      awardXpForAction(state, "create_experiment");
      saveState(state);

      hypoInput.value = "";
      renderAll();
    });
  }

  // Quick Actions
  const quickAddProject = $("#quickAddProject");
  if (quickAddProject) {
    quickAddProject.addEventListener("click", () => {
      const name = prompt("Название проекта:");
      if (name && name.trim()) {
        createProject(state, { name: name.trim() });
        awardXpForAction(state, "create_project");
        saveState(state);
        renderAll();
      }
    });
  }

  const quickAddExperiment = $("#quickAddExperiment");
  if (quickAddExperiment) {
    quickAddExperiment.addEventListener("click", () => {
      if (!state.projects.length) {
        alert("Сначала создай проект!");
        return;
      }
      // Переключаемся на вкладку Experiments
      document.querySelector('[data-screen="experiments"]').click();
    });
  }

  const quickAddRevenue = $("#quickAddRevenue");
  if (quickAddRevenue) {
    quickAddRevenue.addEventListener("click", () => {
      if (!state.projects.length) {
        alert("Сначала создай проект!");
        return;
      }
      // Переключаемся на вкладку Projects к форме дохода
      document.querySelector('[data-screen="projects"]').click();
    });
  }

  // Project filters
  const filterStatus = $("#filterStatus");
  if (filterStatus) {
    filterStatus.addEventListener("change", (e) => {
      currentProjectFilter = e.target.value;
      renderProjects();
    });
  }

  // Quest tabs
  const questTabs = document.querySelectorAll(".quest-tab");
  questTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      questTabs.forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      currentQuestFilter = e.target.dataset.questFilter;
      renderQuests();
    });
  });
}
