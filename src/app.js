//Простейший HTML+JS прототип: дашборд + форма добавления проекта + форма обновления дохода.
// src/app.js

import {
  createInitialState,
  createProject,
  updateProject,
  updateProjectRevenue
} from "./models.js";
import { loadState, saveState } from "./storage.js";
import { awardXpForAction } from "./gameLogic.js";

let state = null;

// --- Init ---

function init() {
  state = loadState();
  renderDashboard();
  renderProjects();
  setupEventHandlers();
}

window.addEventListener("DOMContentLoaded", init);

// --- Rendering helpers ---

function $(selector) {
  return document.querySelector(selector);
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
    li.textContent = ach.earnedAt
      ? `✅ ${ach.name}`
      : `⬜ ${ach.name}`;
    achievementsList.appendChild(li);
  });
}

function renderProjects() {
  const container = $("#projectsList");
  container.innerHTML = "";

  if (state.projects.length === 0) {
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
    meta.innerHTML = `
      <span>Статус: </span>
    `;
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

// --- Event handlers ---

function setupEventHandlers() {
  const projectForm = $("#projectForm");
  projectForm.addEventListener("submit", e => {
    e.preventDefault();
    const nameInput = $("#projectName");
    const name = nameInput.value.trim();
    if (!name) return;

    createProject(state, { name });
    awardXpForAction(state, "create_project");
    saveState(state);

    nameInput.value = "";
    renderDashboard();
    renderProjects();
  });

  const revenueForm = $("#revenueForm");
  revenueForm.addEventListener("submit", e => {
    e.preventDefault();
    if (state.projects.length === 0) {
      alert("Нет проектов для обновления дохода.");
      return;
    }

    const amountInput = $("#revenueAmount");
    const amount = parseFloat(amountInput.value.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    const projectIdSelect = $("#revenueProject");
    const projectId = projectIdSelect.value;

    updateProjectRevenue(state, projectId, amount);
    awardXpForAction(state, "add_revenue", { amount });
    saveState(state);

    amountInput.value = "";
    renderDashboard();
    renderProjects();
  });

  // заполнение селекта проектов для дохода
  updateRevenueProjectOptions();
}

function updateRevenueProjectOptions() {
  const select = $("#revenueProject");
  if (!select) return;

  select.innerHTML = "";
  state.projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

// Немного "самотестирования": при первом запуске без проектов добавим один демо-проект (можно убрать)
if (!window.__GAMIFY_DEMO__) {
  window.__GAMIFY_DEMO__ = true;
  const onFirstLoad = () => {
    if (state && state.projects.length === 0) {
      createProject(state, { name: "Demo Project" });
      saveState(state);
      renderDashboard();
      renderProjects();
    }
  };
  window.addEventListener("DOMContentLoaded", onFirstLoad);
}
