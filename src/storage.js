// Обёртка над localStorage.
// src/storage.js

import { createInitialState } from "./models.js";

const STORAGE_KEY = "gamify-product-lab-state";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }
    const parsed = JSON.parse(raw);
    // простая защита, если версия изменилась
    if (!parsed.version) {
      parsed.version = "1.0";
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load state:", e);
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, raw);
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}
