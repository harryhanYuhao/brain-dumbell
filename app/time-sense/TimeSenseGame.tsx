"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const TARGETS = [3, 5, 10, 0] as const; // 0 = a random target each round
const ROUND_COUNTS = [3, 5, 8] as const;
const RANDOM_RANGE = [2, 12] as const;

type Settings = { targetSec: number; rounds: number };
const DEFAULTS: Settings = { targetSec: 5, rounds: 5 };

const store = createStoredValue("brain-dumbell:time-sense-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    targetSec: pickOne(r.targetSec, TARGETS, DEFAULTS.targetSec),
    rounds: pickOne(r.rounds, ROUND_COUNTS, DEFAULTS.rounds),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:time-sense-best:${s.targetSec}|${s.rounds}`;

type Phase = "idle" | "ready" | "timing" | "result" | "done";
type Attempt = { target: number; actual: number };

const errorPct = (a: Attempt) => ((a.actual - a.target) / a.target) * 100;
const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

function pickTarget(s: Settings) {
  const [lo, hi] = RANDOM_RANGE;
  return s.targetSec || lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function TimeSenseGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [target, setTarget] = useState(settings.targetSec);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [best, setBest] = useState<{ value: string; isNew: boolean } | null>(null);
  const startedAt = useRef(0);

  function start() {
    setRound(settings);
    setAttempts([]);
    setBest(null);
    setTarget(pickTarget(settings));
    setPhase("ready");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function act(at: number) {
    if (phase === "ready") {
      startedAt.current = at;
      setPhase("timing");
    } else if (phase === "timing") {
      setAttempts([...attempts, { target, actual: (at - startedAt.current) / 1000 }]);
      setPhase("result");
    } else if (phase === "result") {
      if (attempts.length >= round.rounds) {
        const avg = attempts.reduce((a, t) => a + Math.abs(errorPct(t)), 0) / attempts.length;
        const b = recordBest(bestKey(round), Math.round(avg * 10) / 10, true);
        setBest({ value: `${b.value.toFixed(1)}%`, isNew: b.isNew });
        setPhase("done");
      } else {
        setTarget(pickTarget(round));
        setPhase("ready");
      }
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") return setPhase("idle");
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      act(e.timeStamp);
    }
  });

  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
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
            <Field
              label="Target"
              hint={
                settings.targetSec
                  ? `Stop at exactly ${settings.targetSec} seconds`
                  : `A new target between ${RANDOM_RANGE[0]} and ${RANDOM_RANGE[1]} seconds each round`
              }
            >
              <Segmented
                options={TARGETS.map((t) => ({ value: t, label: t ? `${t}s` : "Random" }))}
                value={settings.targetSec}
                onChange={(v) => set("targetSec", v)}
              />
            </Field>
            <Field label="Rounds">
              <Segmented
                options={ROUND_COUNTS.map((n) => ({ value: n, label: String(n) }))}
                value={settings.rounds}
                onChange={(v) => set("rounds", v)}
              />
            </Field>
          </div>
          <p className="text-sm text-muted">
            No clock, no ticking: just you. Counting &ldquo;one-thousand, two-thousand&rdquo; is
            allowed, but see how close you get by feel alone.
          </p>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const avg = attempts.reduce((a, t) => a + Math.abs(errorPct(t)), 0) / attempts.length;
    const bias = attempts.reduce((a, t) => a + errorPct(t), 0) / attempts.length;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Average error"
            value={`${avg.toFixed(1)}%`}
            best={best}
            meta={`${round.targetSec ? `${round.targetSec}s target` : "random targets"} · ${round.rounds} rounds`}
          />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Tendency" value={signedPct(bias)} />
            <Stat
              label="Closest"
              value={`${Math.min(...attempts.map((t) => Math.abs(errorPct(t)))).toFixed(1)}%`}
            />
          </dl>
          <p className="max-w-md text-sm text-muted">
            {bias > 3
              ? "You tend to stop late: time feels shorter to you than it is."
              : bias < -3
                ? "You tend to stop early: time feels longer to you than it is."
                : "No strong lean either way. Your inner clock is well calibrated."}
          </p>
          <AttemptList attempts={attempts} />
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const last = attempts.at(-1);
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            Round {phase === "result" ? attempts.length : attempts.length + 1}{" "}
            <span className="text-muted">/ {round.rounds}</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) act(e.timeStamp);
          }}
          className={`flex h-64 touch-manipulation select-none flex-col items-center justify-center gap-3 rounded-xl border-2 transition-colors sm:h-72 ${
            phase === "timing" ? "border-accent bg-accent-soft" : "border-transparent bg-background"
          }`}
        >
          {phase === "ready" && (
            <>
              <span className="text-sm uppercase tracking-widest text-muted">Target</span>
              <span className="text-6xl font-bold tabular-nums">{target}s</span>
              <span className="text-sm text-muted">Tap or press Space to start the clock</span>
            </>
          )}
          {phase === "timing" && (
            <>
              <span className="text-2xl font-semibold text-accent">Timing… {target}s</span>
              <span className="text-sm text-muted">Tap or press Space to stop</span>
            </>
          )}
          {phase === "result" && last && (
            <>
              <span className="text-6xl font-bold tabular-nums">{last.actual.toFixed(2)}s</span>
              <span
                className={`text-lg font-semibold ${
                  Math.abs(errorPct(last)) <= 5 ? "text-green-600 dark:text-green-400" : "text-muted"
                }`}
              >
                {signedPct(errorPct(last))} vs {last.target}s
              </span>
              <span className="text-sm text-muted">
                Tap or press Space for {attempts.length >= round.rounds ? "results" : "the next round"}
              </span>
            </>
          )}
        </button>
        {attempts.length > 0 && <AttemptList attempts={attempts} />}
      </div>
    </Card>
  );
}

function AttemptList({ attempts }: { attempts: Attempt[] }) {
  return (
    <ol className="mx-auto flex w-full max-w-sm flex-col gap-1 text-sm">
      {attempts.map((a, i) => (
        <li key={i} className="flex justify-between rounded-lg bg-background px-3 py-1.5 tabular-nums">
          <span className="text-muted">
            {i + 1}. {a.target}s target
          </span>
          <span>
            {a.actual.toFixed(2)}s <span className="text-muted">({signedPct(errorPct(a))})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
