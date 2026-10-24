"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Field, PrimaryButton, Stat, Stepper, Switch } from "../components/ui";
import { readNumber, writeNumber } from "../lib/stored-value";
import {
  DEFAULT_SCHULTE,
  SIZE_RANGE,
  bestKey,
  saveSchulteSettings,
  useSchulteSettings,
  type SchulteSettings,
} from "./settings";

type Phase = "idle" | "playing" | "done";

function shuffled(count: number) {
  const cells = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

function formatTime(ms: number, decimals = 2) {
  return `${(ms / 1000).toFixed(decimals)}s`;
}

// Text size shrinks as the grid gets denser.
const CELL_TEXT: Record<number, string> = {
  3: "text-4xl sm:text-5xl",
  4: "text-3xl sm:text-4xl",
  5: "text-2xl sm:text-3xl",
  6: "text-xl sm:text-2xl",
  7: "text-lg sm:text-xl",
  8: "text-base sm:text-lg",
  9: "text-sm sm:text-base",
};

export function SchulteGame() {
  const settings = useSchulteSettings();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<SchulteSettings>(settings);
  const [cells, setCells] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [miss, setMiss] = useState<{ value: number; id: number } | null>(null);
  const [best, setBest] = useState<{ ms: number; isNew: boolean } | null>(null);
  const startedAt = useRef(0);
  const missCount = useRef(0);

  const total = round.size * round.size;

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startedAt.current), 50);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!miss) return;
    const id = setTimeout(() => setMiss(null), 350);
    return () => clearTimeout(id);
  }, [miss]);

  function start() {
    setRound(settings);
    setCells(shuffled(settings.size * settings.size));
    setNext(1);
    setMistakes(0);
    setElapsed(0);
    setMiss(null);
    setBest(null);
    setPhase("playing");
    startedAt.current = performance.now();
  }

  // `at` is the input event's timeStamp — same clock as performance.now().
  function press(value: number, at: number) {
    if (phase !== "playing") return;
    if (value !== next) {
      // Tapping an already-found number is harmless; anything else is a mistake.
      if (value > next) {
        setMistakes((m) => m + 1);
        missCount.current += 1;
        setMiss({ value, id: missCount.current });
      }
      return;
    }
    if (value === total) {
      const ms = at - startedAt.current;
      setElapsed(ms);
      const previous = readNumber(bestKey(round));
      const isNew = previous === null || ms < previous;
      if (isNew) writeNumber(bestKey(round), ms);
      setBest({ ms: isNew ? ms : previous, isNew });
      setPhase("done");
      return;
    }
    setNext(value + 1);
    if (round.reshuffle) setCells(shuffled(total));
  }

  if (phase === "idle") {
    const set = <K extends keyof SchulteSettings>(key: K, value: SchulteSettings[K]) =>
      saveSchulteSettings({ ...settings, [key]: value });
    const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SCHULTE);
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Board size"
              hint={`${settings.size} × ${settings.size} — numbers 1 to ${settings.size ** 2}`}
            >
              <Stepper
                value={settings.size}
                range={SIZE_RANGE}
                onChange={(v) => set("size", v)}
                label="rows and columns"
              />
            </Field>
            <Field label="Mark found numbers" hint="Off is harder: you have to remember where you are">
              <Switch checked={settings.markFound} onChange={(v) => set("markFound", v)}>
                {settings.markFound ? "On" : "Off"}
              </Switch>
            </Field>
            <Field label="Reshuffle after each tap" hint="The board scrambles every time you find a number">
              <Switch checked={settings.reshuffle} onChange={(v) => set("reshuffle", v)}>
                {settings.reshuffle ? "On" : "Off"}
              </Switch>
            </Field>
          </div>
          <BoardPreview size={settings.size} />
          <div className="flex flex-col items-center gap-3">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
            {!isDefault && (
              <button
                type="button"
                onClick={() => saveSchulteSettings(DEFAULT_SCHULTE)}
                className="text-sm text-muted hover:text-foreground"
              >
                Reset to defaults
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">Your time</p>
            <p className="text-7xl font-bold tabular-nums">{formatTime(elapsed)}</p>
            {best?.isNew ? (
              <p className="font-medium text-accent">New personal best! 🎉</p>
            ) : (
              best && <p className="text-sm text-muted">Personal best: {formatTime(best.ms)}</p>
            )}
            <p className="mt-2 text-xs text-muted">
              {round.size} × {round.size}
              {round.markFound ? "" : " · unmarked"}
              {round.reshuffle ? " · reshuffling" : ""}
            </p>
          </div>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Mistakes" value={mistakes} />
            <Stat label="Per number" value={formatTime(elapsed / total)} />
          </dl>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="rounded-full border border-border px-6 py-3 font-semibold transition hover:border-accent"
            >
              Change settings
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 items-center text-sm">
          <span className="font-medium tabular-nums">
            {formatTime(elapsed, 1)}
          </span>
          <span className="text-center">
            <span className="text-muted">Find </span>
            <span className="text-2xl font-bold tabular-nums text-accent">{next}</span>
          </span>
          <span className="text-right font-medium tabular-nums">
            {mistakes} <span className="text-muted">{mistakes === 1 ? "mistake" : "mistakes"}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${((next - 1) / total) * 100}%` }}
          />
        </div>
        <div
          className="mx-auto grid w-full gap-1.5 sm:gap-2"
          // Fit the whole board on screen: limited by width and by viewport height.
          style={{
            gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))`,
            maxWidth: "min(32rem, 60svh)",
          }}
        >
          {cells.map((value) => {
            const found = value < next && round.markFound;
            const missed = miss?.value === value;
            return (
              <button
                key={round.reshuffle ? `${next}-${value}` : value}
                type="button"
                onPointerDown={(e) => {
                  if (e.button === 0) press(value, e.timeStamp);
                }}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    press(value, e.timeStamp);
                  }
                }}
                aria-label={String(value)}
                className={`grid aspect-square touch-manipulation select-none place-items-center rounded-lg border font-mono font-bold tabular-nums transition-colors duration-150 ${CELL_TEXT[round.size]} ${
                  missed
                    ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400"
                    : found
                      ? "border-transparent bg-accent-soft text-accent/40"
                      : "border-border bg-background hover:border-accent"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="mx-auto text-xs text-muted hover:text-foreground"
        >
          Quit round
        </button>
      </div>
    </Card>
  );
}

/** Blank board showing the chosen size; numbers appear only when the round starts. */
function BoardPreview({ size }: { size: number }) {
  return (
    <div className="flex justify-center rounded-xl bg-background p-6">
      <div
        className="grid w-full max-w-48 gap-1"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: size * size }, (_, i) => (
          <span key={i} className="aspect-square rounded-sm border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
