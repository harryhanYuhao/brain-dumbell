"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { categories, type Exercise } from "../exercises";

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
        <div className="absolute right-0 z-20 mt-2 max-h-[calc(100svh-5rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl">
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            {categories.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5">
                <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {c.name}
                </p>
                <ul>
                  {exercises
                    .filter((e) => e.category === c.id)
                    .map((exercise) => {
                      const current = pathname === exercise.href;
                      return (
                        <li key={exercise.href}>
                          <Link
                            href={exercise.href}
                            onClick={() => setOpen(false)}
                            aria-current={current ? "page" : undefined}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-accent-soft ${current ? "bg-accent-soft" : ""}`}
                          >
                            <span
                              aria-hidden
                              className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-sm font-bold text-accent"
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
