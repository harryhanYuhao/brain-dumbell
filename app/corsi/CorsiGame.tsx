"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Card,
  Field,
  PrimaryButton,
  SecondaryButton,
  Segmented,
  Stat,
  Stepper,
} from "../components/ui";
import { seededRng, shuffle, type Rng } from "../lib/random";
import {
  asRecord,
  createStoredValue,
  pickInt,
  pickOne,
  readNumber,
  writeNumber,
} from "../lib/stored-value";

const BOARD_SIZES = [
  { value: "standard", label: "Standard", grid: 3, block: 16, maxWidth: "26rem" },
  { value: "large", label: "Large", grid: 4, block: 12, maxWidth: "36rem" },
  { value: "huge", label: "Huge", grid: 5, block: 10, maxWidth: "46rem" },
] as const;
type BoardSize = (typeof BOARD_SIZES)[number]["value"];
const boardOf = (size: BoardSize) => BOARD_SIZES.find((b) => b.value === size)!;

const LAYOUTS = ["random", "grid"] as const;
type Layout = (typeof LAYOUTS)[number];
/** Top-left corner of a block, in % of the board. */
type Position = readonly [number, number];

const SPEEDS = [
  { value: 1000, label: "Slow" },
  { value: 800, label: "Normal" },
  { value: 600, label: "Fast" },
] as const;
const DIRECTIONS = ["forward", "backward"] as const;
const START_RANGE = [2, 5] as const;

type Settings = {
  direction: (typeof DIRECTIONS)[number];
  stepMs: number;
  startSpan: number;
  size: BoardSize;
  layout: Layout;
};
const DEFAULTS: Settings = {
  direction: "forward",
  stepMs: 800,
  startSpan: 3,
  size: "standard",
  layout: "random",
};

const store = createStoredValue("brain-dumbell:corsi-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    direction: pickOne(r.direction, DIRECTIONS, DEFAULTS.direction),
    stepMs: pickOne(r.stepMs, SPEEDS.map((s) => s.value), DEFAULTS.stepMs),
    startSpan: pickInt(r.startSpan, START_RANGE, DEFAULTS.startSpan),
    size: pickOne(r.size, BOARD_SIZES.map((b) => b.value), DEFAULTS.size),
    layout: pickOne(r.layout, LAYOUTS, DEFAULTS.layout),
  };
});

const bestKey = (s: Settings) =>
  `brain-dumbell:corsi-best:${s.direction}|${s.stepMs}|${s.size}|${s.layout}`;

type Phase = "idle" | "showing" | "input" | "feedback" | "done";

function randomSequence(length: number, blockCount: number) {
  return shuffle(Array.from({ length: blockCount }, (_, i) => i)).slice(0, length);
}

function gridLayout(size: BoardSize): Position[] {
  const { grid, block } = boardOf(size);
  const cell = 100 / grid;
  const inset = (cell - block) / 2;
  return Array.from({ length: grid * grid }, (_, i) => [
    (i % grid) * cell + inset,
    Math.floor(i / grid) * cell + inset,
  ]);
}

/** Scatters blocks at random spots, keeping a clear gap between any two. */
function randomLayout(size: BoardSize, rng: Rng = Math.random): Position[] {
  const { grid, block } = boardOf(size);
  const count = grid * grid;
  const minDistance = block + 3;
  for (let restart = 0; restart < 50; restart++) {
    const placed: Position[] = [];
    for (let tries = 0; placed.length < count && tries < 4000; tries++) {
      const x = rng() * (100 - block);
      const y = rng() * (100 - block);
      if (placed.every(([px, py]) => Math.abs(px - x) >= minDistance || Math.abs(py - y) >= minDistance)) {
        placed.push([x, y]);
      }
    }
    if (placed.length === count) return placed;
  }
  return gridLayout(size); // practically unreachable at these densities
}

function makeLayout(s: Settings, rng: Rng = Math.random) {
  return s.layout === "grid" ? gridLayout(s.size) : randomLayout(s.size, rng);
}

export function CorsiGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [span, setSpan] = useState(settings.startSpan);
  const [attempt, setAttempt] = useState(1);
  const [blocks, setBlocks] = useState<Position[]>([]);
  const [sequence, setSequence] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<"pass" | "fail" | null>(null);
  const [longest, setLongest] = useState(0);
  const [best, setBest] = useState<{ span: number; isNew: boolean } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Play the sequence: light each block in turn, then hand over to the player.
  useEffect(() => {
    if (phase !== "showing") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const on = Math.round(round.stepMs * 0.7);
    const lead = 600;
    sequence.forEach((block, k) => {
      timers.push(setTimeout(() => setLit(block), lead + k * round.stepMs));
      timers.push(setTimeout(() => setLit(null), lead + k * round.stepMs + on));
    });
    timers.push(setTimeout(() => setPhase("input"), lead + sequence.length * round.stepMs));
    return () => timers.forEach(clearTimeout);
  }, [phase, sequence, round.stepMs]);

  // After a result, pause briefly before the next sequence (or the end).
  const continueRun = useEffectEvent(() => {
    if (outcome === "pass") {
      if (span >= blocks.length) finish(span);
      else beginSequence(span + 1, 1);
    } else if (attempt === 1) {
      beginSequence(span, 2);
    } else {
      finish(longest);
    }
  });

  useEffect(() => {
    if (phase !== "feedback") return;
    const id = setTimeout(continueRun, 1300);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  function beginSequence(length: number, attemptNo: number, blockCount = blocks.length) {
    setSpan(length);
    setAttempt(attemptNo);
    setSequence(randomSequence(length, blockCount));
    setTaps([]);
    setOutcome(null);
    setLit(null);
    setPhase("showing");
  }

  function start() {
    // Random layouts are drawn fresh for every run.
    const layout = makeLayout(settings);
    setRound(settings);
    setBlocks(layout);
    setLongest(0);
    setBest(null);
    beginSequence(settings.startSpan, 1, layout.length);
  }

  function finish(score: number) {
    const key = bestKey(round);
    const previous = readNumber(key) ?? 0;
    if (score > previous) writeNumber(key, score);
    setBest({ span: Math.max(score, previous), isNew: score > previous });
    setLongest(score);
    setPhase("done");
  }

  function tap(block: number) {
    if (phase !== "input") return;
    clearTimeout(tapTimer.current);
    setLit(block);
    tapTimer.current = setTimeout(() => setLit(null), 200);

    const order = round.direction === "forward" ? sequence : [...sequence].reverse();
    const next = [...taps, block];
    setTaps(next);
    if (order[next.length - 1] !== block) {
      setOutcome("fail");
      setPhase("feedback");
    } else if (next.length === order.length) {
      setLongest(span);
      setOutcome("pass");
      setPhase("feedback");
    }
  }

  if (phase === "idle") {
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
      store.save({ ...settings, [key]: value });
    // Seeded, so the server and browser draw the same example layout.
    const preview = makeLayout(settings, seededRng(7));
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Direction"
              hint={
                settings.direction === "forward"
                  ? "Repeat the sequence in the same order"
                  : "Repeat it in reverse: last block first. Much harder"
              }
            >
              <Segmented
                options={[
                  { value: "forward", label: "Forward" },
                  { value: "backward", label: "Backward" },
                ]}
                value={settings.direction}
                onChange={(v) => set("direction", v)}
              />
            </Field>
            <Field label="Speed" hint={`${settings.stepMs / 1000}s per block`}>
              <Segmented options={[...SPEEDS]} value={settings.stepMs} onChange={(v) => set("stepMs", v)} />
            </Field>
            <Field
              label="Board size"
              hint={`${boardOf(settings.size).grid ** 2} blocks${settings.size === "standard" ? "" : " on a bigger board"}`}
            >
              <Segmented
                options={BOARD_SIZES.map((b) => ({ value: b.value, label: b.label }))}
                value={settings.size}
                onChange={(v) => set("size", v)}
              />
            </Field>
            <Field
              label="Block layout"
              hint={
                settings.layout === "random"
                  ? "Blocks scattered at random spots, new every run"
                  : "Blocks in neat rows and columns"
              }
            >
              <Segmented
                options={[
                  { value: "random", label: "Random" },
                  { value: "grid", label: "Grid" },
                ]}
                value={settings.layout}
                onChange={(v) => set("layout", v)}
              />
            </Field>
            <Field label="Starting length" hint={`First sequence has ${settings.startSpan} blocks`}>
              <Stepper
                value={settings.startSpan}
                range={START_RANGE}
                onChange={(v) => set("startSpan", v)}
                label="blocks"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <Board
              blocks={preview}
              size={settings.size}
              lit={null}
              disabled
            />
            {settings.layout === "random" && (
              <p className="text-center text-xs text-muted">
                Example layout. Every run gets a new random one.
              </p>
            )}
          </div>
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
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">Your Corsi span</p>
            <p className="text-7xl font-bold tabular-nums">{longest}</p>
            {best?.isNew ? (
              <p className="font-medium text-accent">New personal best! 🎉</p>
            ) : (
              best && <p className="text-sm text-muted">Personal best: {best.span}</p>
            )}
            <p className="mt-2 text-xs text-muted">
              {round.direction} · {SPEEDS.find((s) => s.value === round.stepMs)?.label.toLowerCase()} ·{" "}
              {boardOf(round.size).label.toLowerCase()} {round.layout} board
            </p>
          </div>
          <p className="max-w-md text-sm text-muted">
            {longest === 0
              ? "No sequence completed this time. Try a shorter starting length."
              : longest >= blocks.length
                ? "You cleared every block on the board. Try backward mode or a faster speed."
                : `Most adults remember 5 to 7 blocks going forward, and a little fewer going backward.`}
          </p>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Longest" value={`${longest} blocks`} />
            <Stat label="Failed at" value={longest >= blocks.length ? "—" : `${span} blocks`} />
          </dl>
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
      ? "Watch…"
      : phase === "input"
        ? round.direction === "forward"
          ? "Your turn: same order"
          : "Your turn: reverse order"
        : outcome === "pass"
          ? "Correct!"
          : attempt === 1
            ? "Not quite. One more try at this length"
            : "Not quite. That's the end of the run";

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {span} blocks <span className="text-muted">· try {attempt} of 2</span>
          </span>
          <span className="font-medium tabular-nums">
            {phase === "input" || phase === "feedback" ? `${taps.length} / ${span}` : ""}
          </span>
        </div>
        <p
          className={`text-center text-lg font-semibold ${
            phase === "feedback"
              ? outcome === "pass"
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
        <Board
          blocks={blocks}
          size={round.size}
          lit={lit}
          disabled={phase !== "input"}
          onTap={tap}
          wrong={phase === "feedback" && outcome === "fail" ? taps.at(-1) : undefined}
        />
        <button type="button" onClick={() => setPhase("idle")} className="mx-auto text-xs text-muted hover:text-foreground">
          Quit
        </button>
      </div>
    </Card>
  );
}

function Board({
  blocks,
  size,
  lit,
  disabled,
  onTap,
  wrong,
}: {
  blocks: Position[];
  size: BoardSize;
  lit: number | null;
  disabled: boolean;
  onTap?: (block: number) => void;
  wrong?: number;
}) {
  const { block, maxWidth } = boardOf(size);
  return (
    <div
      className="relative mx-auto aspect-square w-full rounded-2xl bg-background"
      // As big as the size allows while the whole board still fits on screen.
      style={{ maxWidth: `min(${maxWidth}, calc(100svh - 15rem))` }}
    >
      {blocks.map(([x, y], i) => (
        <button
          key={i}
          type="button"
          aria-label={`Block ${i + 1}`}
          disabled={disabled}
          onPointerDown={(e) => {
            if (e.button === 0) onTap?.(i);
          }}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              onTap?.(i);
            }
          }}
          className={`absolute touch-manipulation rounded-lg border-2 transition-colors duration-100 ${
            wrong === i
              ? "border-red-500 bg-red-500"
              : lit === i
                ? "border-accent bg-accent"
                : "border-border bg-surface enabled:hover:border-accent"
          } ${disabled ? "cursor-default" : "cursor-pointer"}`}
          style={{ left: `${x}%`, top: `${y}%`, width: `${block}%`, height: `${block}%` }}
        />
      ))}
    </div>
  );
}
