// app.js
// Простейший прототип: 3 экрана, проекты, эксперименты, доход, XP/уровни.

import {
  createProject,
  updateProject,
  updateProjectRevenue,
  createExperiment,
  updateExperiment
} from "./models.js";
import { loadState, saveState } from "./storage.js";
import { awardXpForAction } from "./gameLogic.js";

let state = null;

// --- Init ---

function init() {
  state = loadState();
  normalizeState();
  setupTabs();
  setupEventHandlers();
  renderAll();
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
}

// --- Tabs (экраны) ---

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;

      // активная кнопка
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // активный экран
      document.querySelectorAll(".screen").forEach(scr => {
        scr.classList.remove("active");
      });
      const screenEl = document.getElementById(`screen-${target}`);
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
  updateProjectSelects();
}

function renderDashboard() {
  const gp = state.gameProfile;

  $("#level").textContent = gp.level;
  $("#xp").textContent = gp.xp;
  $("#xpToNext").textContent = gp.xpToNextLevel;
  $("#streak").textContent = gp.streakDays;
  $("#totalRevenue").textContent = gp.totalRevenue.toFixed(2);

  const achievementsList = $("#achievementsList");
  achievementsList.innerHTML = "";

  state.achievements.forEach(ach => {
    const li = document.createElement("li");
    li.textContent = ach.earnedAt ? `✅ ${ach.name}` : `⬜ ${ach.name}`;
    achievementsList.appendChild(li);
  });
}

function renderProjects() {
  const container = $("#projectsList");
  container.innerHTML = "";

  if (!state.projects.length) {
    container.textContent = "Пока нет проектов. Добавь первую идею!";
    return;
  }

  state.projects.forEach(project => {
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
      updateProject(state, project.id, { status: statusSelect.value });
      if (oldStatus !== statusSelect.value) {
        awardXpForAction(state, "update_project_status");
        saveState(state);
        renderDashboard();
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

// --- Event handlers ---

function setupEventHandlers() {
  // формы
  const projectForm = $("#projectForm");
  if (projectForm) {
    projectForm.addEventListener("submit", e => {
      e.preventDefault();
      const nameInput = $("#projectName");
      const name = nameInput.value.trim();
      if (!name) return;

      createProject(state, { name });
      awardXpForAction(state, "create_project");
      saveState(state);

      nameInput.value = "";
      renderAll();
    });
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
      saveState(state);

      hypoInput.value = "";
      renderExperiments();
    });
  }
}
