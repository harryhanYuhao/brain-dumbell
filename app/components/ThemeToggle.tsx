"use client";

import { THEME_KEY } from "../theme";

function currentTheme() {
  const saved = document.documentElement.getAttribute("data-theme");
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable — the choice just lasts for this page view.
    }
  }

  // Both icons are rendered and CSS picks one, so server and client markup match.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark mode"
      title="Toggle light/dark mode"
      className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="size-5 dark:hidden"
        aria-hidden
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="hidden size-5 dark:block"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
