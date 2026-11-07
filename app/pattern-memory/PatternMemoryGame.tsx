"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  Card,
  ExitButton,
  Field,
  PrimaryButton,
  ResultHeadline,
  SecondaryButton,
  Segmented,
  Stat,
} from "../components/ui";
import { shuffle } from "../lib/random";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const SHOW_TIMES = [
  { value: 600, label: "Quick" },
  { value: 1000, label: "Normal" },
  { value: 1600, label: "Long" },
] as const;
const LIVES = 3;
// A level fails after this many wrong tiles.
const MISTAKES_PER_LEVEL = 3;
// Grid grows so the pattern never fills more than this share of it.
const MAX_FILL = 0.45;
const MAX_GRID = 7;

type Settings = { showMs: number };
const DEFAULTS: Settings = { showMs: 1000 };

const store = createStoredValue("brain-dumbell:pattern-memory-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return { showMs: pickOne(r.showMs, SHOW_TIMES.map((s) => s.value), DEFAULTS.showMs) };
});

const bestKey = (s: Settings) => `brain-dumbell:pattern-memory-best:${s.showMs}`;

type Phase = "idle" | "showing" | "input" | "feedback" | "done";

const tilesFor = (level: number) => level + 2;
function gridFor(level: number) {
  let n = 3;
  while (n < MAX_GRID && tilesFor(level) > n * n * MAX_FILL) n++;
  return n;
}

export function PatternMemoryGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(LIVES);
  const [pattern, setPattern] = useState<Set<number>>(new Set());
  const [found, setFound] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [passed, setPassed] = useState(false);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);

  const grid = gridFor(level);

  useEffect(() => {
    if (phase !== "showing") return;
    const id = setTimeout(() => setPhase("input"), 500 + round.showMs);
    return () => clearTimeout(id);
  }, [phase, round.showMs]);

  const continueRun = useEffectEvent(() => {
    if (passed) beginLevel(level + 1);
    else if (lives > 0) beginLevel(level);
    else finish();
  });

  useEffect(() => {
    if (phase !== "feedback") return;
    const id = setTimeout(continueRun, 1200);
    return () => clearTimeout(id);
  }, [phase]);

  function beginLevel(next: number) {
    const n = gridFor(next);
    setLevel(next);
    setPattern(new Set(shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, tilesFor(next))));
    setFound(new Set());
    setWrong(new Set());
    setPhase("showing");
  }

  function start() {
    setRound(settings);
    setLives(LIVES);
    setBest(null);
    beginLevel(1);
  }

  function finish() {
    setBest(recordBest(bestKey(round), level - 1));
    setPhase("done");
  }

  function tap(i: number) {
    if (phase !== "input" || found.has(i) || wrong.has(i)) return;
    if (pattern.has(i)) {
      const next = new Set(found).add(i);
      setFound(next);
      if (next.size === pattern.size) {
        setPassed(true);
        setPhase("feedback");
      }
    } else {
      const next = new Set(wrong).add(i);
      setWrong(next);
      if (next.size >= MISTAKES_PER_LEVEL) {
        setLives(lives - 1);
        setPassed(false);
        setPhase("feedback");
      }
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setPhase("idle");
  });

  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Show time" hint={`The pattern is visible for ${settings.showMs / 1000}s`}>
              <Segmented
                options={[...SHOW_TIMES]}
                value={settings.showMs}
                onChange={(v) => store.save({ ...settings, showMs: v })}
              />
            </Field>
          </div>
          <p className="text-sm text-muted">
            Level 1 lights up {tilesFor(1)} tiles, and every level adds one more. The grid grows
            as you go. Three wrong tiles fail the level, and you have {LIVES} lives.
          </p>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const cleared = level - 1;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Levels cleared"
            value={cleared}
            best={best}
            meta={`${SHOW_TIMES.find((s) => s.value === round.showMs)?.label.toLowerCase()} show time`}
          />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Largest pattern" value={cleared ? `${tilesFor(cleared)} tiles` : "—"} />
            <Stat label="Grid reached" value={`${grid} × ${grid}`} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            Try seeing the pattern as a shape (an L, a zigzag, a face) rather than separate
            tiles. One picture is easier to hold than ten dots.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const status =
    phase === "showing"
      ? "Memorise the pattern…"
      : phase === "input"
        ? `Find the ${pattern.size} tiles · ${pattern.size - found.size} to go`
        : passed
          ? "Level cleared!"
          : lives > 0
            ? "Three misses. One life gone"
            : "Out of lives";

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            Level {level} <span className="text-muted">· {pattern.size} tiles</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium" aria-label={`${lives} lives`}>
            {"♥".repeat(lives)}
            <span className="text-muted">{"♡".repeat(LIVES - lives)}</span>
          </span>
        </div>
        <p
          className={`text-center text-lg font-semibold ${
            phase === "feedback"
              ? passed
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
              : phase === "input"
                ? "text-accent"
                : "text-muted"
          }`}
          aria-live="polite"
        >
          {status}
        </p>
        <div
          className="mx-auto grid aspect-square w-full gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))`,
            maxWidth: "min(28rem, calc(100svh - 16rem))",
          }}
        >
          {Array.from({ length: grid * grid }, (_, i) => {
            const lit =
              phase === "showing" || found.has(i) || (phase === "feedback" && pattern.has(i));
            return (
              <button
                key={`${level}-${i}`}
                type="button"
                aria-label={`Tile ${i + 1}`}
                disabled={phase !== "input"}
                onPointerDown={(e) => {
                  if (e.button === 0) tap(i);
                }}
                className={`touch-manipulation rounded-lg border-2 transition-colors duration-150 ${
                  wrong.has(i)
                    ? "border-red-500 bg-red-500/80"
                    : lit && pattern.has(i)
                      ? found.has(i) || phase === "showing"
                        ? "border-accent bg-accent"
                        : "border-accent bg-accent/40"
                      : "border-border bg-background enabled:hover:border-accent"
                }`}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}
