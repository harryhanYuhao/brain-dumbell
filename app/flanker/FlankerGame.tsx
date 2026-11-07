"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Card,
  ExitButton,
  Field,
  PrimaryButton,
  ProgressBar,
  ResultHeadline,
  SecondaryButton,
  Segmented,
  Stat,
} from "../components/ui";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const DURATIONS = [30, 60, 90] as const;
const POSITIONS = ["fixed", "jitter"] as const;
const SIDES = [2, 3] as const;

type Settings = {
  durationSec: number;
  position: (typeof POSITIONS)[number];
  flankers: number;
};
const DEFAULTS: Settings = { durationSec: 30, position: "fixed", flankers: 2 };

const store = createStoredValue("brain-dumbell:flanker-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    position: pickOne(r.position, POSITIONS, DEFAULTS.position),
    flankers: pickOne(r.flankers, SIDES, DEFAULTS.flankers),
  };
});

const bestKey = (s: Settings) =>
  `brain-dumbell:flanker-best:${s.durationSec}|${s.position}|${s.flankers}`;

type Dir = "left" | "right";
type Trial = { target: Dir; congruent: boolean; dx: number; dy: number };
type Result = { trial: Trial; correct: boolean; rt: number };
type Phase = "idle" | "playing" | "done";

function makeTrial(s: Settings): Trial {
  const jitter = s.position === "jitter";
  return {
    target: Math.random() < 0.5 ? "left" : "right",
    congruent: Math.random() < 0.5,
    // Offsets from the centre, in % of the stage.
    dx: jitter ? (Math.random() - 0.5) * 20 : 0,
    dy: jitter ? (Math.random() - 0.5) * 50 : 0,
  };
}

const arrow = (d: Dir) => (d === "left" ? "←" : "→");
const flip = (d: Dir): Dir => (d === "left" ? "right" : "left");

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function Arrows({ trial, flankers }: { trial: Trial; flankers: number }) {
  const side = arrow(trial.congruent ? trial.target : flip(trial.target)).repeat(flankers);
  return (
    <span className="select-none font-mono text-5xl font-bold sm:text-6xl">
      {side}
      {arrow(trial.target)}
      {side}
    </span>
  );
}

export function FlankerGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; id: number } | null>(null);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  useEffect(() => {
    if (trial) shownAt.current = performance.now();
  }, [trial]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 200);
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
        setBest(recordBest(bestKey(round), resultsRef.current.filter((r) => r.correct).length));
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
    setTrial(makeTrial(settings));
    setPhase("playing");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function answer(choice: Dir, at: number) {
    if (phase !== "playing" || !trial) return;
    const result: Result = { trial, correct: choice === trial.target, rt: at - shownAt.current };
    resultsRef.current = [...resultsRef.current, result];
    setResults(resultsRef.current);
    setFlash({ ok: result.correct, id: resultsRef.current.length });
    setTrial(makeTrial(round));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "Escape") setPhase("idle");
    else if (e.key === "ArrowLeft" || e.key === "f") answer("left", e.timeStamp);
    else if (e.key === "ArrowRight" || e.key === "j") answer("right", e.timeStamp);
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
            <Field label="Time limit">
              <Segmented
                options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                value={settings.durationSec}
                onChange={(v) => set("durationSec", v)}
              />
            </Field>
            <Field label="Flankers" hint={`${settings.flankers} arrows on each side of the middle one`}>
              <Segmented
                options={SIDES.map((n) => ({ value: n, label: `${n * 2 + 1} arrows` }))}
                value={settings.flankers}
                onChange={(v) => set("flankers", v)}
              />
            </Field>
            <Field
              label="Position"
              hint={
                settings.position === "fixed"
                  ? "Arrows always appear in the centre"
                  : "Arrows jump around, so you can't fix your eyes in advance"
              }
            >
              <Segmented
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "jitter", label: "Jumping" },
                ]}
                value={settings.position}
                onChange={(v) => set("position", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-background px-4 py-6 text-center">
            <span className="text-xs uppercase tracking-wider text-muted">Example</span>
            <Arrows trial={{ target: "left", congruent: false, dx: 0, dy: 0 }} flankers={settings.flankers} />
            <span className="text-sm text-muted">
              The answer is <strong className="text-foreground">Left</strong>: only the middle
              arrow counts.
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
    const congruent = rt(correct.filter((r) => r.trial.congruent));
    const incongruent = rt(correct.filter((r) => !r.trial.congruent));
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const effect =
      congruent === null || incongruent === null ? "—" : `${incongruent - congruent >= 0 ? "+" : ""}${Math.round(incongruent - congruent)} ms`;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Correct answers"
            value={correct.length}
            best={best}
            meta={`${round.flankers * 2 + 1} arrows · ${round.position} · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Avg. time" value={ms(rt(correct))} />
            <Stat label="Arrows agree" value={ms(congruent)} />
            <Stat label="Arrows clash" value={ms(incongruent)} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            <span className="font-semibold text-foreground">Flanker effect: {effect}</span> — the
            extra time the clashing neighbours cost you. Smaller means sharper focus.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

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
            className={`relative h-56 overflow-hidden rounded-xl border-2 bg-background transition-colors sm:h-64 ${
              flash === null ? "border-transparent" : flash.ok ? "border-green-500/60" : "border-red-500/70"
            }`}
          >
            <div
              key={results.length}
              className="absolute -translate-1/2"
              style={{ left: `${50 + trial.dx}%`, top: `${50 + trial.dy}%` }}
            >
              <Arrows trial={trial} flankers={round.flankers} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["left", "right"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onPointerDown={(e) => {
                if (e.button === 0) answer(d, e.timeStamp);
              }}
              className="flex touch-manipulation select-none items-center justify-center gap-2 rounded-xl border border-border bg-surface py-5 text-2xl font-semibold transition-colors hover:border-accent active:bg-accent-soft"
            >
              {arrow(d)}
              <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs text-muted sm:inline">
                {d === "left" ? "F" : "J"}
              </kbd>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          Tap a side, or press ← → (or F / J) · Esc to exit
        </p>
      </div>
    </Card>
  );
}
