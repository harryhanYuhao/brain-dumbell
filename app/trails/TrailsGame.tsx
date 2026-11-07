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
import { seededRng, type Rng } from "../lib/random";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const PARTS = ["A", "B"] as const;
const COUNTS = [16, 24] as const;
// Circle diameter, in % of the board.
const NODE = 9;

type Settings = { part: (typeof PARTS)[number]; count: number };
const DEFAULTS: Settings = { part: "A", count: 16 };

const store = createStoredValue("brain-dumbell:trails-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    part: pickOne(r.part, PARTS, DEFAULTS.part),
    count: pickOne(r.count, COUNTS, DEFAULTS.count),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:trails-best:${s.part}|${s.count}`;

type Phase = "idle" | "playing" | "done";
/** Centre of a circle, in % of the board. */
type Point = readonly [number, number];

/** Labels in the order they must be tapped: 1 2 3… or 1 A 2 B 3 C… */
function labels(s: Settings) {
  return Array.from({ length: s.count }, (_, i) =>
    s.part === "A" ? String(i + 1) : i % 2 === 0 ? String(i / 2 + 1) : String.fromCharCode(65 + (i - 1) / 2),
  );
}

function scatter(count: number, rng: Rng = Math.random): Point[] {
  const minDistance = count > 16 ? NODE + 4 : NODE + 7;
  const lo = NODE / 2 + 1;
  for (;;) {
    const placed: Point[] = [];
    for (let tries = 0; placed.length < count && tries < 5000; tries++) {
      const p = [lo + rng() * (100 - 2 * lo), lo + rng() * (100 - 2 * lo)] as const;
      if (placed.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minDistance)) placed.push(p);
    }
    if (placed.length === count) return placed;
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function TrailsGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [points, setPoints] = useState<Point[]>([]);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<{ value: string; isNew: boolean } | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startedAt.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (wrong === null) return;
    const id = setTimeout(() => setWrong(null), 300);
    return () => clearTimeout(id);
  }, [wrong]);

  function start() {
    setRound(settings);
    setPoints(scatter(settings.count));
    setDone(0);
    setErrors(0);
    setWrong(null);
    setElapsed(0);
    setBest(null);
    startedAt.current = performance.now();
    setPhase("playing");
  }

  function tap(i: number, at: number) {
    if (phase !== "playing" || i < done) return;
    if (i !== done) {
      setErrors(errors + 1);
      setWrong(i);
      return;
    }
    setDone(done + 1);
    if (done + 1 === points.length) {
      const time = at - startedAt.current;
      setElapsed(time);
      const b = recordBest(bestKey(round), Math.round(time), true);
      setBest({ value: seconds(b.value), isNew: b.isNew });
      setPhase("done");
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setPhase("idle");
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
            <Field
              label="Part"
              hint={
                settings.part === "A"
                  ? "Numbers only: 1 → 2 → 3 …"
                  : "Alternate numbers and letters: 1 → A → 2 → B …"
              }
            >
              <Segmented
                options={[
                  { value: "A", label: "A · Numbers" },
                  { value: "B", label: "B · Switching" },
                ]}
                value={settings.part}
                onChange={(v) => set("part", v)}
              />
            </Field>
            <Field label="Circles">
              <Segmented
                options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
                value={settings.count}
                onChange={(v) => set("count", v)}
              />
            </Field>
          </div>
          {/* Seeded, so the server and browser draw the same example. */}
          <Board points={scatter(settings.count, seededRng(11))} names={labels(settings)} done={2} />
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Your time"
            value={seconds(elapsed)}
            best={best}
            meta={`Part ${round.part} · ${round.count} circles`}
          />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Wrong taps" value={errors} />
            <Stat label="Per circle" value={seconds(elapsed / round.count)} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            {round.part === "A"
              ? "Part A is mostly visual search and speed. Try Part B: the gap between your A and B times shows how much switching costs you."
              : "Part B adds switching between two sequences. Compare it with your Part A time: a smaller gap means more flexible thinking."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const names = labels(round);
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">{seconds(elapsed)}</span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            Next: <span className="text-accent">{names[done]}</span>
          </span>
        </div>
        <Board points={points} names={names} done={done} wrong={wrong} onTap={tap} />
      </div>
    </Card>
  );
}

function Board({
  points,
  names,
  done,
  wrong,
  onTap,
}: {
  points: Point[];
  names: string[];
  done: number;
  wrong?: number | null;
  onTap?: (i: number, at: number) => void;
}) {
  return (
    <div
      className="relative mx-auto aspect-square w-full rounded-2xl bg-background"
      style={{ maxWidth: "min(36rem, calc(100svh - 14rem))" }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <polyline
          points={points.slice(0, done).map((p) => p.join(",")).join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {points.map(([x, y], i) => (
        <button
          key={i}
          type="button"
          disabled={!onTap}
          onPointerDown={(e) => {
            if (e.button === 0) onTap?.(i, e.timeStamp);
          }}
          className={`absolute grid -translate-1/2 touch-manipulation select-none place-items-center rounded-full border-2 text-sm font-bold transition-colors sm:text-base ${
            wrong === i
              ? "border-red-500 bg-red-500 text-white"
              : i < done
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface enabled:hover:border-accent"
          }`}
          style={{ left: `${x}%`, top: `${y}%`, width: `${NODE}%`, height: `${NODE}%` }}
        >
          {names[i]}
        </button>
      ))}
    </div>
  );
}
