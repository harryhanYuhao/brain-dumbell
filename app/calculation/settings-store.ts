import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from "./problems";

const KEY = "brain-dumbell:calculation-settings";
const listeners = new Set<() => void>();

// Used when localStorage is unavailable, so changes still apply this visit.
let memory: string | null = null;
let cachedRaw: string | null | undefined;
let cached: Settings = DEFAULT_SETTINGS;

function readRaw() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function getSnapshot(): Settings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
    } catch {
      cached = DEFAULT_SETTINGS;
    }
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveSettings(settings: Settings) {
  memory = JSON.stringify(settings);
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    // Fall back to `memory` only.
  }
  listeners.forEach((l) => l());
}

/** Settings persisted in localStorage; the server render uses the defaults. */
export function useSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);
}
