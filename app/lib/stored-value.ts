import { useSyncExternalStore } from "react";

/**
 * A JSON value persisted in localStorage and shared by every component that
 * reads it. The server render (and any unreadable value) uses `fallback`.
 */
export function createStoredValue<T>(
  key: string,
  fallback: T,
  sanitize: (raw: unknown) => T,
) {
  const listeners = new Set<() => void>();
  // Used when localStorage is unavailable, so changes still apply this visit.
  let memory: string | null = null;
  let cachedRaw: string | null | undefined;
  let cached = fallback;

  function readRaw() {
    try {
      return localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  }

  function getSnapshot(): T {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cached = raw ? sanitize(JSON.parse(raw)) : fallback;
      } catch {
        cached = fallback;
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

  function save(value: T) {
    memory = JSON.stringify(value);
    try {
      localStorage.setItem(key, memory);
    } catch {
      // Fall back to `memory` only.
    }
    listeners.forEach((l) => l());
  }

  function useValue() {
    return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  }

  return { useValue, save };
}

/** Reads a number from localStorage, e.g. a best score; null if missing. */
export function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null || Number.isNaN(Number(raw)) ? null : Number(raw);
  } catch {
    return null;
  }
}

export function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable (private mode etc.) — the value just isn't kept.
  }
}

// Helpers for sanitizing settings read back from storage.

export function pickInt(
  v: unknown,
  [lo, hi]: readonly [number, number],
  fallback: number,
) {
  return typeof v === "number" && Number.isInteger(v)
    ? Math.min(hi, Math.max(lo, v))
    : fallback;
}

export function pickOne<T>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

export function pickBool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

export function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}
