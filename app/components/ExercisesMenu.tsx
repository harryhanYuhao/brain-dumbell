"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Exercise } from "../exercises";

export function ExercisesMenu({ exercises }: { exercises: Exercise[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
      >
        Exercises
        <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-xl">
          {exercises.map((exercise) => {
            const current = pathname === exercise.href;
            return (
              <li key={exercise.href}>
                <Link
                  href={exercise.href}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent-soft ${current ? "bg-accent-soft" : ""}`}
                >
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft font-bold text-accent"
                  >
                    {exercise.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{exercise.name}</span>
                    <span className="text-xs text-muted">{exercise.tagline}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
