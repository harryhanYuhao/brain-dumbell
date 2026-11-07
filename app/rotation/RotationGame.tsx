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
import { seededRng, type Rng } from "../lib/random";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const DURATIONS = [30, 60, 90] as const;
const SIZES = [5, 6, 7] as const;
const ANGLES = ["right", "any"] as const;

type Settings = {
  durationSec: number;
  cells: number;
  angles: (typeof ANGLES)[number];
};
const DEFAULTS: Settings = { durationSec: 60, cells: 6, angles: "right" };

const store = createStoredValue("brain-dumbell:rotation-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    cells: pickOne(r.cells, SIZES, DEFAULTS.cells),
    angles: pickOne(r.angles, ANGLES, DEFAULTS.angles),
  };
});

const bestKey = (s: Settings) =>
  `brain-dumbell:rotation-best:${s.durationSec}|${s.cells}|${s.angles}`;

type Cell = readonly [number, number];
type Answer = "same" | "mirror";
type Trial = { cells: Cell[]; answer: Answer; leftDeg: number; rightDeg: number };
type Result = { correct: boolean; rt: number };
type Phase = "idle" | "playing" | "done";

function normalize(cells: Cell[]): string {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .join(";");
}

const rotate90 = (cells: Cell[]) => cells.map(([x, y]) => [y, -x] as const);
const mirror = (cells: Cell[]) => cells.map(([x, y]) => [-x, y] as const);

/** True when no rotation of the shape equals its mirror image. */
function isChiral(cells: Cell[]) {
  const target = normalize(mirror(cells));
  let r = cells;
  for (let i = 0; i < 4; i++) {
    if (normalize(r) === target) return false;
    r = rotate90(r);
  }
  return true;
}

/** A random connected shape of `n` squares that looks different from its mirror. */
function randomShape(n: number, rng: Rng): Cell[] {
  for (;;) {
    const cells: Cell[] = [[0, 0]];
    while (cells.length < n) {
      const [x, y] = cells[Math.floor(rng() * cells.length)];
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
      const next = [x + dx, y + dy] as const;
      if (!cells.some((c) => c[0] === next[0] && c[1] === next[1])) cells.push(next);
    }
    if (isChiral(cells)) return cells;
  }
}

function randomAngle(s: Settings, rng: Rng) {
  // Never 0°, so the right shape always needs turning.
  return s.angles === "right" ? 90 * (1 + Math.floor(rng() * 3)) : 30 + Math.floor(rng() * 300);
}

function makeTrial(s: Settings, rng: Rng = Math.random): Trial {
  return {
    cells: randomShape(s.cells, rng),
    answer: rng() < 0.5 ? "same" : "mirror",
    leftDeg: s.angles === "right" ? 0 : Math.floor(rng() * 360),
    rightDeg: randomAngle(s, rng),
  };
}

function Shape({ cells, deg, flipped }: { cells: Cell[]; deg: number; flipped?: boolean }) {
  const shown = flipped ? mirror(cells) : cells;
  const xs = shown.map((c) => c[0]);
  const ys = shown.map((c) => c[1]);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  // Square view big enough for the shape at any angle.
  const r = Math.max(...shown.flatMap(([x, y]) => [Math.hypot(x - cx, y - cy), Math.hypot(x + 1 - cx, y + 1 - cy)])) + 0.3;
  return (
    <svg viewBox={`${cx - r} ${cy - r} ${2 * r} ${2 * r}`} className="aspect-square w-full max-w-56" aria-hidden>
      <g transform={`rotate(${deg} ${cx} ${cy})`}>
        {shown.map(([x, y]) => (
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            className="fill-accent stroke-surface"
            strokeWidth={0.08}
          />
        ))}
      </g>
    </svg>
  );
}

export function RotationGame() {
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

  function answer(choice: Answer, at: number) {
    if (phase !== "playing" || !trial) return;
    const result = { correct: choice === trial.answer, rt: at - shownAt.current };
    resultsRef.current = [...resultsRef.current, result];
    setResults(resultsRef.current);
    setFlash({ ok: result.correct, id: resultsRef.current.length });
    setTrial(makeTrial(round));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "Escape") setPhase("idle");
    else if (e.key === "ArrowLeft" || e.key === "f") answer("same", e.timeStamp);
    else if (e.key === "ArrowRight" || e.key === "j") answer("mirror", e.timeStamp);
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
      store.save({ ...settings, [key]: value });
    // Seeded, so the server and browser draw the same example.
    const example = makeTrial(settings, seededRng(3));
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
            <Field label="Shape size" hint={`Shapes made of ${settings.cells} squares`}>
              <Segmented
                options={SIZES.map((n) => ({ value: n, label: String(n) }))}
                value={settings.cells}
                onChange={(v) => set("cells", v)}
              />
            </Field>
            <Field
              label="Angles"
              hint={
                settings.angles === "right"
                  ? "Turned by 90°, 180° or 270°"
                  : "Both shapes turned by any angle. Harder"
              }
            >
              <Segmented
                options={[
                  { value: "right", label: "Right angles" },
                  { value: "any", label: "Any angle" },
                ]}
                value={settings.angles}
                onChange={(v) => set("angles", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-background px-4 py-6 text-center">
            <span className="text-xs uppercase tracking-wider text-muted">Example</span>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4">
              <Shape cells={example.cells} deg={example.leftDeg} />
              <Shape cells={example.cells} deg={example.rightDeg} flipped />
            </div>
            <span className="text-sm text-muted">
              The answer is <strong className="text-foreground">Mirror</strong>: no amount of
              turning makes the right one match the left.
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
    const avg = correct.length ? correct.reduce((a, r) => a + r.rt, 0) / correct.length : null;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Correct answers"
            value={correct.length}
            best={best}
            meta={`${round.cells} squares · ${round.angles === "right" ? "right angles" : "any angle"} · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Avg. time" value={avg === null ? "—" : `${(avg / 1000).toFixed(2)} s`} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            Guessing gets you 50%, so accuracy matters more than speed here. Bigger turns take
            longer to picture: that delay is the mental rotation itself.
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
            key={results.length}
            className={`grid grid-cols-2 place-items-center gap-4 rounded-xl border-2 bg-background p-4 transition-colors ${
              flash === null ? "border-transparent" : flash.ok ? "border-green-500/60" : "border-red-500/70"
            }`}
          >
            <Shape cells={trial.cells} deg={trial.leftDeg} />
            <Shape cells={trial.cells} deg={trial.rightDeg} flipped={trial.answer === "mirror"} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["same", "mirror"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onPointerDown={(e) => {
                if (e.button === 0) answer(a, e.timeStamp);
              }}
              className="flex touch-manipulation select-none items-center justify-center gap-2 rounded-xl border border-border bg-surface py-4 text-lg font-semibold transition-colors hover:border-accent active:bg-accent-soft"
            >
              {a === "same" ? "Same" : "Mirror"}
              <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs text-muted sm:inline">
                {a === "same" ? "F" : "J"}
              </kbd>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          Same shape turned, or its mirror image? ← / F for same, → / J for mirror · Esc to exit
        </p>
      </div>
    </Card>
  );
}
