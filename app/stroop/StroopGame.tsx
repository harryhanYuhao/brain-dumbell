"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Card,
  ExitButton,
  Field,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  Segmented,
  Stat,
  Stepper,
} from "../components/ui";
import {
  asRecord,
  createStoredValue,
  pickInt,
  pickOne,
  readNumber,
  writeNumber,
} from "../lib/stored-value";

const COLORS = [
  { id: "red", name: "Red" },
  { id: "blue", name: "Blue" },
  { id: "green", name: "Green" },
  { id: "yellow", name: "Yellow" },
  { id: "purple", name: "Purple" },
  { id: "orange", name: "Orange" },
  { id: "pink", name: "Pink" },
  { id: "brown", name: "Brown" },
  { id: "cyan", name: "Cyan" },
  { id: "gray", name: "Gray" },
] as const;
type ColorId = (typeof COLORS)[number]["id"];

const DURATIONS = [20, 30, 60] as const;
const MODES = ["classic", "switch", "benchmark"] as const;
// Share of trials where word and ink agree; the rest clash.
const CONGRUENT_SHARE = 0.25;

type Settings = {
  colors: number;
  durationSec: number;
  mode: (typeof MODES)[number];
};
const DEFAULTS: Settings = { colors: 4, durationSec: 30, mode: "classic" };

const store = createStoredValue("brain-dumbell:stroop-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    colors: pickInt(r.colors, [3, COLORS.length], DEFAULTS.colors),
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    mode: pickOne(r.mode, MODES, DEFAULTS.mode),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:stroop-best:${s.colors}|${s.durationSec}|${s.mode}`;
// Average reaction time from the latest benchmark round, per colour count
// (the button layout changes with it).
const baselineKey = (s: Settings) => `brain-dumbell:stroop-baseline:${s.colors}`;

type Rule = "ink" | "word";
type Trial = { word: ColorId; ink: ColorId; rule: Rule };
type Result = { trial: Trial; correct: boolean; rt: number; switched: boolean };
type Phase = "idle" | "playing" | "done";

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeTrial(s: Settings, prev: Trial | null): Trial {
  const palette = COLORS.slice(0, s.colors).map((c) => c.id);
  for (; ;) {
    const word = randomItem(palette);
    const ink =
      s.mode === "benchmark" || Math.random() < CONGRUENT_SHARE
        ? word
        : randomItem(palette.filter((c) => c !== word));
    const rule: Rule = s.mode === "switch" ? randomItem(["ink", "word"] as const) : "ink";
    if (!prev || prev.word !== word || prev.ink !== ink) return { word, ink, rule };
  }
}

const target = (t: Trial) => (t.rule === "ink" ? t.ink : t.word);
const nameOf = (id: ColorId) => COLORS.find((c) => c.id === id)!.name;

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function StroopGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; id: number } | null>(null);
  const [best, setBest] = useState<{ score: number; isNew: boolean } | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  // Reaction time is measured from when each word is put on screen.
  useEffect(() => {
    if (trial) shownAt.current = performance.now();
  }, [trial]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 250);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    if (phase !== "playing") return;
    const endAt = performance.now() + round.durationSec * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        const score = resultsRef.current.filter((r) => r.correct).length;
        const previous = readNumber(bestKey(round)) ?? 0;
        if (score > previous) writeNumber(bestKey(round), score);
        setBest({ score: Math.max(score, previous), isNew: score > previous });
        if (round.mode === "benchmark") {
          const avg = mean(resultsRef.current.filter((r) => r.correct).map((r) => r.rt));
          if (avg !== null) writeNumber(baselineKey(round), avg);
          setBaseline(null);
        } else {
          setBaseline(readNumber(baselineKey(round)));
        }
        setPhase("done");
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, round]);

  function start() {
    resultsRef.current = [];
    setRound(settings);
    setResults([]);
    setFlash(null);
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setTrial(makeTrial(settings, null));
    setPhase("playing");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function answer(choice: ColorId, at: number) {
    if (phase !== "playing" || !trial) return;
    const prev = resultsRef.current.at(-1);
    const result: Result = {
      trial,
      correct: choice === target(trial),
      rt: at - shownAt.current,
      switched: !!prev && prev.trial.rule !== trial.rule,
    };
    resultsRef.current = [...resultsRef.current, result];
    setResults(resultsRef.current);
    setFlash({ ok: result.correct, id: resultsRef.current.length });
    setTrial(makeTrial(round, trial));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") return setPhase("idle");
    // Keys 1–9, then 0 for the tenth colour.
    const index = e.key === "0" ? 9 : Number(e.key) - 1;
    if (e.repeat || !Number.isInteger(index) || index < 0 || index >= round.colors) return;
    answer(COLORS[index].id, e.timeStamp);
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
      store.save({ ...settings, [key]: value });
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Colours" hint={COLORS.slice(0, settings.colors).map((c) => c.name).join(", ")}>
              <Stepper
                value={settings.colors}
                range={[3, COLORS.length]}
                onChange={(v) => set("colors", v)}
                label="colours"
              />
            </Field>
            <Field label="Time limit">
              <Segmented
                options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                value={settings.durationSec}
                onChange={(v) => set("durationSec", v)}
              />
            </Field>
            <Field
              label="Mode"
              hint={
                settings.mode === "classic"
                  ? "Always answer the ink colour"
                  : settings.mode === "switch"
                    ? "A cue above each word says whether to answer the INK or the WORD"
                    : "Word and ink always match — measures your baseline reaction time"
              }
              wide
            >
              <Segmented
                options={[
                  { value: "classic", label: "Classic" },
                  { value: "switch", label: "Switch" },
                  { value: "benchmark", label: "Benchmark" },
                ]}
                value={settings.mode}
                onChange={(v) => set("mode", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-background px-4 py-6 text-center">
            <span className="text-xs uppercase tracking-wider text-muted">Example</span>
            <span
              className="text-5xl font-black tracking-wide"
              style={{ color: "var(--stroop-blue)" }}
            >
              {settings.mode === "benchmark" ? "BLUE" : "RED"}
            </span>
            <span className="text-sm text-muted">
              The answer is <strong className="text-foreground">Blue</strong>
              {settings.mode === "benchmark" ? "." : ": the ink, not the word."}
            </span>
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.durationSec}s</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct);
    const accuracy = results.length ? Math.round((correct.length / results.length) * 100) : 0;
    const rt = (rs: Result[]) => mean(rs.map((r) => r.rt));
    const congruent = rt(correct.filter((r) => r.trial.word === r.trial.ink));
    const clashing = rt(correct.filter((r) => r.trial.word !== r.trial.ink));
    const switches = rt(correct.filter((r) => r.switched));
    const repeats = rt(correct.filter((r, i) => i > 0 && !r.switched));
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const diff = (a: number | null, b: number | null) =>
      a === null || b === null ? "—" : `${a - b >= 0 ? "+" : ""}${Math.round(a - b)} ms`;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">Correct answers</p>
            <p className="text-7xl font-bold tabular-nums">{correct.length}</p>
            {best?.isNew ? (
              <p className="font-medium text-accent">New personal best! 🎉</p>
            ) : (
              best && <p className="text-sm text-muted">Personal best: {best.score}</p>
            )}
            <p className="mt-2 text-xs text-muted">
              {round.colors} colours · {round.mode} · {round.durationSec}s
            </p>
          </div>
          {round.mode === "benchmark" ? (
            <>
              <dl className="grid w-full max-w-md grid-cols-2 gap-4">
                <Stat label="Accuracy" value={`${accuracy}%`} />
                <Stat label="Avg. time" value={ms(rt(correct))} />
              </dl>
              <p className="max-w-md text-sm text-muted">
                Saved as your baseline for {round.colors} colours. Classic and Switch results
                will be compared against it.
              </p>
            </>
          ) : (
            <dl className="grid w-full max-w-md grid-cols-2 gap-4">
              <Stat label="Accuracy" value={`${accuracy}%`} />
              <Stat label="Avg. time" value={ms(rt(correct))} />
              <Stat label="Matching words" value={ms(congruent)} />
              <Stat label="Clashing words" value={ms(clashing)} />
            </dl>
          )}
          <div className="flex max-w-md flex-col gap-1 text-sm text-muted">
            {round.mode !== "benchmark" && (
              <p>
                <span className="font-semibold text-foreground">Stroop effect: {diff(clashing, congruent)}</span>{" "}
                — the extra time a clashing word costs you. Smaller means better control.
              </p>
            )}
            {round.mode !== "benchmark" && (
              <p>
                <span className="font-semibold text-foreground">vs. baseline: {diff(rt(correct), baseline)}</span>{" "}
                — {baseline === null
                  ? "play a Benchmark round to record your baseline."
                  : "your average time compared with your latest benchmark."}
              </p>
            )}
            {round.mode === "switch" && (
              <p>
                <span className="font-semibold text-foreground">Switch cost: {diff(switches, repeats)}</span>{" "}
                — the extra time when the rule changes.
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const palette = COLORS.slice(0, round.colors);
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {Math.ceil(remaining / 1000)}s <span className="text-muted">left</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            {results.filter((r) => r.correct).length} <span className="text-muted">correct</span>
          </span>
        </div>
        <ProgressBar value={remaining / (round.durationSec * 1000)} />
        {trial && (
          <div
            className={`flex h-48 flex-col items-center justify-center gap-3 rounded-xl border-2 bg-background transition-colors sm:h-56 ${flash === null ? "border-transparent" : flash.ok ? "border-green-500/60" : "border-red-500/70"
              }`}
          >
            {round.mode === "switch" && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold tracking-widest ${trial.rule === "ink" ? "bg-foreground text-background" : "border-2 border-foreground"
                  }`}
              >
                {trial.rule === "ink" ? "INK" : "WORD"}
              </span>
            )}
            <span
              key={results.length}
              className="select-none text-6xl font-black tracking-wide sm:text-7xl"
              style={{ color: `var(--stroop-${trial.ink})` }}
            >
              {nameOf(trial.word).toUpperCase()}
            </span>
          </div>
        )}
        <div
          className={`grid gap-2 ${palette.length <= 4
              ? "grid-cols-2"
              : palette.length <= 6
                ? "grid-cols-3"
                : palette.length <= 8
                  ? "grid-cols-3 sm:grid-cols-4"
                  : "grid-cols-3 sm:grid-cols-5"
            }`}
        >
          {palette.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onPointerDown={(e) => {
                if (e.button === 0) answer(c.id, e.timeStamp);
              }}
              className="flex touch-manipulation select-none items-center justify-center gap-2 rounded-xl border border-border bg-surface py-4 text-lg font-semibold transition-colors hover:border-accent active:bg-accent-soft"
            >
              {c.name}
              <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs text-muted sm:inline">
                {(i + 1) % 10}
              </kbd>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          Tap a colour or press its number key · Esc to exit
        </p>
      </div>
    </Card>
  );
}
