// app.js
// Простейший прототип: 3 экрана, проекты, эксперименты, доход, XP/уровни.

import {
  createProject,
  updateProject,
  updateProjectRevenue,
  createExperiment,
  updateExperiment,
  createQuest,
  completeQuest,
  addHypothesis,
  validateHypothesis,
  addInsight,
  updateIdeaScore,
  createDistributionExperiment,
  updateDistributionExperiment,
  addDistributionInsight
} from "./models.js";
import { loadState, saveState } from "./storage.js";
import { awardXpForAction, initializeDefaultQuests } from "./gameLogic.js";
import { renderXpChart, renderRevenueChart, renderProgressBar } from "./charts.js";
import {
  calculateStageVelocity,
  calculateMVPTime,
  calculateExperimentsPerWeek,
  calculateOverallMetrics,
  getExperimentsMap,
  getProjectReport
} from "./analytics.js";
import {
  calculateOverallGrowthMetrics,
  analyzeByChannel,
  getBestChannels,
  getWorstChannels,
  compareCreatives,
  analyzeViralMetrics,
  getDistributionInsights,
  analyzeCohortRetention
} from "./growthAnalytics.js";

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
  if (!state.distributionExperiments) state.distributionExperiments = [];
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
  renderAnalytics();
  renderGrowthDashboard();
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

// --- Analytics ---

function renderAnalytics() {
  // Общие метрики
  const metrics = calculateOverallMetrics(state);
  
  const metricsContainer = $("#overallMetrics");
  if (metricsContainer) {
    metricsContainer.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Всего проектов</div>
          <div class="metric-value">${metrics.totalProjects}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Активных проектов</div>
          <div class="metric-value">${metrics.activeProjects}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Запущено</div>
          <div class="metric-value">${metrics.launchedProjects}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Всего экспериментов</div>
          <div class="metric-value">${metrics.totalExperiments}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Завершено экспериментов</div>
          <div class="metric-value">${metrics.completedExperiments}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Экспериментов в неделю</div>
          <div class="metric-value">${metrics.experimentsPerWeek}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Среднее время MVP</div>
          <div class="metric-value">${metrics.avgMVPTime > 0 ? metrics.avgMVPTime + ' дней' : 'N/A'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Экспериментов на проект</div>
          <div class="metric-value">${metrics.avgExperimentsPerProject.toFixed(1)}</div>
        </div>
      </div>
    `;
  }

  // Топ идей по рейтингу
  const topIdeasContainer = $("#topIdeas");
  if (topIdeasContainer) {
    if (metrics.topRatedIdeas.length === 0) {
      topIdeasContainer.innerHTML = '<p class="empty-state">Нет идей для оценки. Создайте проекты со статусом "idea".</p>';
    } else {
      topIdeasContainer.innerHTML = metrics.topRatedIdeas.map((idea, index) => `
        <div class="idea-ranking-card">
          <div class="ranking-position">#${index + 1}</div>
          <div class="ranking-info">
            <div class="ranking-name">${idea.name}</div>
            <div class="ranking-score">Рейтинг: ${idea.score}</div>
          </div>
          <button class="view-project-btn" data-project-id="${idea.id}">Подробнее</button>
        </div>
      `).join('');
    }
  }

  // Список проектов с деталями
  renderProjectsList();
}

function renderProjectsList() {
  const projectsListContainer = $("#analyticsProjectsList");
  if (!projectsListContainer) return;

  if (state.projects.length === 0) {
    projectsListContainer.innerHTML = '<p class="empty-state">Проектов пока нет</p>';
    return;
  }

  projectsListContainer.innerHTML = state.projects.map(project => {
    const mvpTime = calculateMVPTime(project);
    const expMap = getExperimentsMap(state, project.id);
    
    return `
      <div class="analytics-project-card">
        <div class="project-card-header">
          <h4>${project.name}</h4>
          <span class="status-badge status-${project.status}">${project.status}</span>
        </div>
        <div class="project-card-body">
          <div class="project-metrics-row">
            <div class="mini-metric">
              <span class="mini-label">Рейтинг идеи:</span>
              <span class="mini-value">${project.ideaScore.totalScore}</span>
            </div>
            <div class="mini-metric">
              <span class="mini-label">Время MVP:</span>
              <span class="mini-value">${mvpTime !== null ? mvpTime + ' д.' : 'N/A'}</span>
            </div>
            <div class="mini-metric">
              <span class="mini-label">Экспериментов:</span>
              <span class="mini-value">${expMap.total}</span>
            </div>
            <div class="mini-metric">
              <span class="mini-label">Гипотез:</span>
              <span class="mini-value">${project.hypotheses.length}</span>
            </div>
          </div>
          <button class="view-project-report-btn" data-project-id="${project.id}">📊 Полный отчёт</button>
        </div>
      </div>
    `;
  }).join('');
}

function showProjectReport(projectId) {
  const report = getProjectReport(state, projectId);
  if (!report) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content project-report-modal">
      <div class="modal-header">
        <h2>${report.project.name}</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Основная информация -->
        <section class="report-section">
          <h3>📌 Основная информация</h3>
          <div class="report-info-grid">
            <div><strong>Статус:</strong> ${report.project.status}</div>
            <div><strong>Создан:</strong> ${new Date(report.project.createdAt).toLocaleDateString()}</div>
            <div><strong>Доход:</strong> $${report.project.revenue}</div>
          </div>
        </section>

        <!-- Рейтинг идеи -->
        <section class="report-section">
          <h3>⭐ Рейтинг идеи: ${report.ideaScore.totalScore}</h3>
          <div class="score-breakdown">
            <div class="score-item">
              <span>Ценность проблемы:</span>
              <span>${report.ideaScore.problemValue}/10</span>
            </div>
            <div class="score-item">
              <span>Масштабируемость:</span>
              <span>${report.ideaScore.scalability}/10</span>
            </div>
            <div class="score-item">
              <span>Время разработки:</span>
              <span>${report.ideaScore.developmentTime}/10</span>
            </div>
          </div>
          <button class="edit-score-btn" data-project-id="${projectId}">✏️ Редактировать рейтинг</button>
        </section>

        <!-- Скорость прохождения стадий -->
        <section class="report-section">
          <h3>⏱️ Скорость прохождения стадий</h3>
          ${Object.keys(report.stageVelocity).length > 0 ? `
            <div class="velocity-list">
              ${Object.entries(report.stageVelocity).map(([stage, days]) => `
                <div class="velocity-item">
                  <span class="stage-name">${stage}:</span>
                  <span class="stage-days">${days} дней</span>
                </div>
              `).join('')}
            </div>
          ` : '<p>Нет данных о переходах между стадиями</p>'}
        </section>

        <!-- MVP время -->
        ${report.mvpTime !== null ? `
          <section class="report-section">
            <h3>🚀 Время до MVP</h3>
            <div class="mvp-time-display">${report.mvpTime} дней</div>
          </section>
        ` : ''}

        <!-- Карта экспериментов -->
        <section class="report-section">
          <h3>🧪 Эксперименты (${report.experiments.total})</h3>
          <div class="experiments-stats">
            <div class="exp-stat">Planned: ${report.experiments.byStatus.planned}</div>
            <div class="exp-stat">Running: ${report.experiments.byStatus.running}</div>
            <div class="exp-stat">Completed: ${report.experiments.byStatus.completed}</div>
            <div class="exp-stat">Canceled: ${report.experiments.byStatus.canceled}</div>
          </div>
          <div class="success-rate">Success Rate: ${report.experiments.successRate}%</div>
        </section>

        <!-- Гипотезы -->
        <section class="report-section">
          <h3>💡 Гипотезы (${report.hypotheses.length})</h3>
          ${report.hypotheses.length > 0 ? `
            <div class="hypotheses-list">
              ${report.hypotheses.map(h => `
                <div class="hypothesis-item ${h.validated ? 'validated' : ''}">
                  <div class="hypothesis-text">${h.text}</div>
                  ${h.validated ? `
                    <div class="hypothesis-result ${h.result}">${h.result === 'success' ? '✅ Подтверждено' : '❌ Отклонено'}</div>
                  ` : `
                    <div class="hypothesis-actions">
                      <button class="validate-btn" data-project-id="${projectId}" data-hypothesis-id="${h.id}" data-result="success">✅ Подтвердить</button>
                      <button class="validate-btn" data-project-id="${projectId}" data-hypothesis-id="${h.id}" data-result="failure">❌ Отклонить</button>
                    </div>
                  `}
                </div>
              `).join('')}
            </div>
          ` : '<p>Гипотез пока нет</p>'}
          <button class="add-hypothesis-btn" data-project-id="${projectId}">➕ Добавить гипотезу</button>
        </section>

        <!-- Insights -->
        <section class="report-section">
          <h3>📝 Что узнали</h3>
          <div class="insights-container">
            <div class="insight-block">
              <h4>✅ Что сработало</h4>
              ${report.insights.whatWorked.length > 0 ? `
                <ul>${report.insights.whatWorked.map(i => `<li>${i}</li>`).join('')}</ul>
              ` : '<p class="empty">Пока нет записей</p>'}
              <button class="add-insight-btn" data-project-id="${projectId}" data-type="whatWorked">➕ Добавить</button>
            </div>
            <div class="insight-block">
              <h4>❌ Что не сработало</h4>
              ${report.insights.whatDidntWork.length > 0 ? `
                <ul>${report.insights.whatDidntWork.map(i => `<li>${i}</li>`).join('')}</ul>
              ` : '<p class="empty">Пока нет записей</p>'}
              <button class="add-insight-btn" data-project-id="${projectId}" data-type="whatDidntWork">➕ Добавить</button>
            </div>
            <div class="insight-block">
              <h4>🎓 Ключевые выводы</h4>
              ${report.insights.keyLearnings.length > 0 ? `
                <ul>${report.insights.keyLearnings.map(i => `<li>${i}</li>`).join('')}</ul>
              ` : '<p class="empty">Пока нет записей</p>'}
              <button class="add-insight-btn" data-project-id="${projectId}" data-type="keyLearnings">➕ Добавить</button>
            </div>
          </div>
        </section>

        <!-- Timeline -->
        <section class="report-section">
          <h3>📅 Timeline</h3>
          ${report.timeline.length > 0 ? `
            <div class="timeline">
              ${report.timeline.map(entry => `
                <div class="timeline-entry">
                  <div class="timeline-date">${new Date(entry.date).toLocaleDateString()}</div>
                  <div class="timeline-event">${entry.event}</div>
                </div>
              `).join('')}
            </div>
          ` : '<p>Нет событий</p>'}
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Закрытие модального окна
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Обработчики для кнопок в модальном окне
  setupReportModalHandlers(modal, projectId);
}

function setupReportModalHandlers(modal, projectId) {
  // Валидация гипотез
  modal.querySelectorAll('.validate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const hypothesisId = btn.dataset.hypothesisId;
      const result = btn.dataset.result;
      validateHypothesis(state, projectId, hypothesisId, result);
      saveState(state);
      modal.remove();
      showProjectReport(projectId);
    });
  });

  // Добавление гипотезы
  modal.querySelector('.add-hypothesis-btn')?.addEventListener('click', () => {
    const text = prompt('Введите гипотезу:');
    if (text && text.trim()) {
      addHypothesis(state, projectId, text.trim());
      saveState(state);
      modal.remove();
      showProjectReport(projectId);
    }
  });

  // Добавление insight
  modal.querySelectorAll('.add-insight-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const text = prompt('Введите наблюдение:');
      if (text && text.trim()) {
        addInsight(state, projectId, type, text.trim());
        saveState(state);
        modal.remove();
        showProjectReport(projectId);
      }
    });
  });

  // Редактирование рейтинга
  modal.querySelector('.edit-score-btn')?.addEventListener('click', () => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const problemValue = prompt('Ценность проблемы (1-10):', project.ideaScore.problemValue);
    const scalability = prompt('Масштабируемость (1-10):', project.ideaScore.scalability);
    const developmentTime = prompt('Скорость разработки (1-10):', project.ideaScore.developmentTime);

    if (problemValue && scalability && developmentTime) {
      updateIdeaScore(state, projectId, {
        problemValue: parseInt(problemValue),
        scalability: parseInt(scalability),
        developmentTime: parseInt(developmentTime)
      });
      saveState(state);
      modal.remove();
      showProjectReport(projectId);
    }
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

  // Analytics - View project report
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("view-project-report-btn")) {
      const projectId = e.target.dataset.projectId;
      showProjectReport(projectId);
    }
    
    if (e.target.classList.contains("view-project-btn")) {
      const projectId = e.target.dataset.projectId;
      showProjectReport(projectId);
    }
  });

  // Growth - Distribution experiments
  const distributionForm = $("#distributionForm");
  if (distributionForm) {
    distributionForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      createDistributionExperiment(state, {
        channel: formData.get("channel"),
        name: formData.get("name"),
        description: formData.get("description"),
        type: formData.get("type"),
        metrics: {
          budget: parseFloat(formData.get("budget")) || 0,
          spent: parseFloat(formData.get("spent")) || 0,
          installs: parseInt(formData.get("installs")) || 0,
          impressions: parseInt(formData.get("impressions")) || 0,
          clicks: parseInt(formData.get("clicks")) || 0,
          retentionR1: parseFloat(formData.get("retentionR1")) || 0,
          retentionR7: parseFloat(formData.get("retentionR7")) || 0,
          retentionR30: parseFloat(formData.get("retentionR30")) || 0,
          arpu: parseFloat(formData.get("arpu")) || 0,
          ltv: parseFloat(formData.get("ltv")) || 0,
          kFactor: parseFloat(formData.get("kFactor")) || 0
        }
      });

      awardXpForAction(state, "create_distribution_experiment");
      saveState(state);
      renderAll();
      e.target.reset();
    });
  }
}

// --- Growth Dashboard ---

function renderGrowthDashboard() {
  const growthMetricsEl = $("#growthMetrics");
  const channelAnalysisEl = $("#channelAnalysis");
  const distributionListEl = $("#distributionList");
  
  if (!growthMetricsEl || !channelAnalysisEl || !distributionListEl) return;

  // Overall growth metrics
  const overallMetrics = calculateOverallGrowthMetrics(state);
  
  growthMetricsEl.innerHTML = `
    <div class="growth-stats">
      <div class="stat">
        <span class="label">Всего экспериментов</span>
        <span class="value">${overallMetrics.totalExperiments}</span>
      </div>
      <div class="stat">
        <span class="label">Всего установок</span>
        <span class="value">${overallMetrics.totalInstalls}</span>
      </div>
      <div class="stat">
        <span class="label">Потрачено</span>
        <span class="value">$${overallMetrics.totalSpent.toFixed(2)}</span>
      </div>
      <div class="stat">
        <span class="label">Средний CPI</span>
        <span class="value">$${overallMetrics.avgCPI.toFixed(2)}</span>
      </div>
      <div class="stat">
        <span class="label">Retention R1</span>
        <span class="value">${overallMetrics.avgRetentionR1.toFixed(1)}%</span>
      </div>
      <div class="stat">
        <span class="label">Retention R7</span>
        <span class="value">${overallMetrics.avgRetentionR7.toFixed(1)}%</span>
      </div>
      <div class="stat">
        <span class="label">Retention R30</span>
        <span class="value">${overallMetrics.avgRetentionR30.toFixed(1)}%</span>
      </div>
      <div class="stat">
        <span class="label">Средний ARPU</span>
        <span class="value">$${overallMetrics.avgARPU.toFixed(2)}</span>
      </div>
      <div class="stat">
        <span class="label">Средний LTV</span>
        <span class="value">$${overallMetrics.avgLTV.toFixed(2)}</span>
      </div>
      <div class="stat">
        <span class="label">Overall ROI</span>
        <span class="value ${overallMetrics.overallROI > 0 ? 'positive' : 'negative'}">
          ${overallMetrics.overallROI.toFixed(1)}%
        </span>
      </div>
      <div class="stat">
        <span class="label">Прибыльных каналов</span>
        <span class="value">${overallMetrics.profitableChannels}</span>
      </div>
      <div class="stat">
        <span class="label">Средний k-factor</span>
        <span class="value ${overallMetrics.avgKFactor > 1 ? 'positive' : ''}">
          ${overallMetrics.avgKFactor.toFixed(2)}
        </span>
      </div>
    </div>
  `;

  // Channel analysis
  const channelData = analyzeByChannel(state);
  const bestChannels = getBestChannels(state);
  const worstChannels = getWorstChannels(state);
  
  let channelHTML = '<h3>📊 Анализ каналов</h3>';
  
  if (bestChannels.length > 0) {
    channelHTML += '<div class="channel-section"><h4>🏆 Лучшие каналы</h4><div class="channel-list">';
    bestChannels.forEach(ch => {
      channelHTML += `
        <div class="channel-card best">
          <div class="channel-name">${getChannelLabel(ch.channel)}</div>
          <div class="channel-stats">
            <span>ROI: <strong class="positive">${ch.roi.toFixed(1)}%</strong></span>
            <span>Installs: ${ch.installs}</span>
            <span>CPI: $${ch.avgCPI.toFixed(2)}</span>
          </div>
        </div>
      `;
    });
    channelHTML += '</div></div>';
  }
  
  if (worstChannels.length > 0) {
    channelHTML += '<div class="channel-section"><h4>⚠️ Требуют оптимизации</h4><div class="channel-list">';
    worstChannels.forEach(ch => {
      channelHTML += `
        <div class="channel-card worst">
          <div class="channel-name">${getChannelLabel(ch.channel)}</div>
          <div class="channel-stats">
            <span>ROI: <strong class="negative">${ch.roi.toFixed(1)}%</strong></span>
            <span>Installs: ${ch.installs}</span>
            <span>CPI: $${ch.avgCPI.toFixed(2)}</span>
          </div>
        </div>
      `;
    });
    channelHTML += '</div></div>';
  }

  // All channels table
  if (channelData.length > 0) {
    channelHTML += '<div class="channel-section"><h4>Все каналы</h4><table class="channel-table"><thead><tr>';
    channelHTML += '<th>Канал</th><th>Эксперименты</th><th>Установки</th><th>Потрачено</th>';
    channelHTML += '<th>CPI</th><th>R1</th><th>R7</th><th>ARPU</th><th>LTV</th><th>ROI</th></tr></thead><tbody>';
    
    channelData.forEach(ch => {
      channelHTML += `
        <tr>
          <td><strong>${getChannelLabel(ch.channel)}</strong></td>
          <td>${ch.experiments}</td>
          <td>${ch.installs}</td>
          <td>$${ch.spent.toFixed(2)}</td>
          <td>$${ch.avgCPI.toFixed(2)}</td>
          <td>${ch.avgRetentionR1.toFixed(1)}%</td>
          <td>${ch.avgRetentionR7.toFixed(1)}%</td>
          <td>$${ch.avgARPU.toFixed(2)}</td>
          <td>$${ch.avgLTV.toFixed(2)}</td>
          <td class="${ch.roi > 0 ? 'positive' : 'negative'}">${ch.roi.toFixed(1)}%</td>
        </tr>
      `;
    });
    channelHTML += '</tbody></table></div>';
  }

  channelAnalysisEl.innerHTML = channelHTML;

  // Distribution experiments list
  if (state.distributionExperiments.length === 0) {
    distributionListEl.innerHTML = '<p class="empty-state">Пока нет distribution experiments. Создайте первый!</p>';
  } else {
    let listHTML = '';
    state.distributionExperiments.forEach(exp => {
      const statusClass = exp.status === 'completed' ? 'completed' : 
                         exp.status === 'running' ? 'running' : 'planning';
      
      listHTML += `
        <div class="distribution-card ${statusClass}">
          <div class="distribution-header">
            <h4>${exp.name}</h4>
            <span class="channel-badge">${getChannelLabel(exp.channel)}</span>
          </div>
          <p class="distribution-description">${exp.description}</p>
          <div class="distribution-metrics">
            <div class="metric">
              <span class="metric-label">Budget</span>
              <span class="metric-value">$${exp.metrics.budget.toFixed(2)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Spent</span>
              <span class="metric-value">$${exp.metrics.spent.toFixed(2)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Installs</span>
              <span class="metric-value">${exp.metrics.installs}</span>
            </div>
            <div class="metric">
              <span class="metric-label">CPI</span>
              <span class="metric-value">$${exp.metrics.cpi.toFixed(2)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">R1</span>
              <span class="metric-value">${exp.metrics.retentionR1.toFixed(1)}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">R7</span>
              <span class="metric-value">${exp.metrics.retentionR7.toFixed(1)}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">ARPU</span>
              <span class="metric-value">$${exp.metrics.arpu.toFixed(2)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">LTV</span>
              <span class="metric-value">$${exp.metrics.ltv.toFixed(2)}</span>
            </div>
          </div>
          <div class="distribution-footer">
            <span class="status-badge ${statusClass}">${getStatusLabel(exp.status)}</span>
            <span class="date">Создан: ${new Date(exp.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      `;
    });
    distributionListEl.innerHTML = listHTML;
  }
}

function getChannelLabel(channel) {
  const labels = {
    organic: '🌱 Organic',
    influencer: '👤 Influencer',
    ppc: '💰 PPC',
    aso: '🔍 ASO',
    viral_loop: '🔄 Viral Loop',
    reddit: '🟠 Reddit',
    tiktok_ads: '🎵 TikTok Ads'
  };
  return labels[channel] || channel;
}

function getStatusLabel(status) {
  const labels = {
    planning: 'Планирование',
    running: 'В процессе',
    completed: 'Завершен',
    paused: 'На паузе',
    failed: 'Неудачный'
  };
  return labels[status] || status;
}
