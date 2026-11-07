"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
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
const SPEEDS = ["steady", "quick"] as const;

type Settings = { durationSec: number; speed: (typeof SPEEDS)[number] };
const DEFAULTS: Settings = { durationSec: 60, speed: "steady" };

const store = createStoredValue("brain-dumbell:twin-steer-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    speed: pickOne(r.speed, SPEEDS, DEFAULTS.speed),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:twin-steer-best:${s.durationSec}|${s.speed}`;

// Board units: 160 × 100.
const W = 160;
const H = 100;
const DOT_R = 3.5;
const TARGET_R = 4.5;
const SPEED: Record<Settings["speed"], number> = { steady: 55, quick: 80 }; // units per second
const STUN_SEC = 0.6;

type Hand = "left" | "right";
type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type World = {
  dots: Record<Hand, Point>;
  targets: Record<Hand, Point>;
  collected: Record<Hand, number>;
  bumps: number;
  /** Seconds the dots are frozen for after crashing into each other. */
  stunned: number;
  remaining: number;
};
type Phase = "idle" | "playing" | "done";

const HANDS = ["left", "right"] as const;
const COLOR: Record<Hand, string> = { left: "text-red-500", right: "text-blue-500" };
const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
// Physical keys (e.code), so WASD works on any keyboard layout.
const KEYS: Record<string, [Hand, Dir]> = {
  KeyW: ["left", "up"],
  KeyA: ["left", "left"],
  KeyS: ["left", "down"],
  KeyD: ["left", "right"],
  ArrowUp: ["right", "up"],
  ArrowLeft: ["right", "left"],
  ArrowDown: ["right", "down"],
  ArrowRight: ["right", "right"],
};
const PAD_LABEL: Record<Hand, Record<Dir, string>> = {
  left: { up: "W", left: "A", down: "S", right: "D" },
  right: { up: "↑", left: "←", down: "↓", right: "→" },
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A target anywhere on the board, well away from `from` so every pickup is a trip. */
function placeTarget(from: Point, avoid: Point): Point {
  for (;;) {
    const p = { x: 8 + Math.random() * (W - 16), y: 8 + Math.random() * (H - 16) };
    if (dist(p, from) > 45 && dist(p, avoid) > 12) return p;
  }
}

function newWorld(s: Settings): World {
  const dots = { left: { x: W * 0.25, y: H / 2 }, right: { x: W * 0.75, y: H / 2 } };
  const left = placeTarget(dots.left, dots.right);
  return {
    dots,
    targets: { left, right: placeTarget(dots.right, left) },
    collected: { left: 0, right: 0 },
    bumps: 0,
    stunned: 0,
    remaining: s.durationSec,
  };
}

const snapshot = (w: World): World => ({
  ...w,
  dots: { left: { ...w.dots.left }, right: { ...w.dots.right } },
  targets: { left: { ...w.targets.left }, right: { ...w.targets.right } },
  collected: { ...w.collected },
});

function Pad({ hand, held }: { hand: Hand; held: RefObject<Set<string>> }) {
  const code = (d: Dir) => Object.keys(KEYS).find((k) => KEYS[k][0] === hand && KEYS[k][1] === d)!;
  const cell = (d: Dir, area: string) => (
    <button
      key={d}
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current.add(code(d));
      }}
      onPointerUp={() => held.current.delete(code(d))}
      onPointerCancel={() => held.current.delete(code(d))}
      style={{ gridArea: area }}
      className={`flex touch-none select-none items-center justify-center rounded-lg border border-border bg-surface py-2 font-mono text-sm font-semibold active:bg-accent-soft ${COLOR[hand]}`}
    >
      {PAD_LABEL[hand][d]}
    </button>
  );
  return (
    <div
      className="grid w-36 gap-1.5"
      style={{ gridTemplateAreas: '". u ." "l d r"', gridTemplateColumns: "repeat(3, 1fr)" }}
    >
      {cell("up", "u")}
      {cell("left", "l")}
      {cell("down", "d")}
      {cell("right", "r")}
    </div>
  );
}

export function TwinSteerGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [view, setView] = useState<World | null>(null);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const world = useRef<World>(newWorld(settings));
  // Codes of keys (or on-screen pad buttons) held down right now.
  const held = useRef(new Set<string>());

  useEffect(() => {
    if (phase !== "playing") return;
    const keys = held.current;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("idle");
      if (!KEYS[e.code]) return;
      e.preventDefault();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      keys.clear();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = world.current;
      w.remaining = Math.max(0, w.remaining - dt);
      w.stunned = Math.max(0, w.stunned - dt);
      if (w.stunned === 0) {
        for (const hand of HANDS) {
          const v = { x: 0, y: 0 };
          for (const code of held.current) {
            const [h, d] = KEYS[code];
            if (h !== hand) continue;
            v.x += STEP[d].x;
            v.y += STEP[d].y;
          }
          const len = Math.hypot(v.x, v.y);
          if (len === 0) continue;
          const dot = w.dots[hand];
          dot.x = clamp(dot.x + (v.x / len) * SPEED[round.speed] * dt, DOT_R, W - DOT_R);
          dot.y = clamp(dot.y + (v.y / len) * SPEED[round.speed] * dt, DOT_R, H - DOT_R);
        }
      }
      for (const hand of HANDS) {
        const other = hand === "left" ? "right" : "left";
        if (dist(w.dots[hand], w.targets[hand]) < DOT_R + TARGET_R) {
          w.collected[hand] += 1;
          w.targets[hand] = placeTarget(w.dots[hand], w.targets[other]);
        }
      }
      // Crashing the dots together knocks them apart and freezes both.
      const gap = dist(w.dots.left, w.dots.right);
      if (gap < DOT_R * 2 && w.stunned === 0) {
        w.bumps += 1;
        w.stunned = STUN_SEC;
        const nx = (w.dots.right.x - w.dots.left.x) / (gap || 1);
        const ny = (w.dots.right.y - w.dots.left.y) / (gap || 1);
        w.dots.left = { x: clamp(w.dots.left.x - nx * 6, DOT_R, W - DOT_R), y: clamp(w.dots.left.y - ny * 6, DOT_R, H - DOT_R) };
        w.dots.right = { x: clamp(w.dots.right.x + nx * 6, DOT_R, W - DOT_R), y: clamp(w.dots.right.y + ny * 6, DOT_R, H - DOT_R) };
      }
      setView(snapshot(w));
      if (w.remaining === 0) {
        setBest(recordBest(bestKey(round), w.collected.left + w.collected.right));
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, round]);

  function start() {
    world.current = newWorld(settings);
    setRound(settings);
    setView(snapshot(world.current));
    setBest(null);
    setPhase("playing");
  }

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
            <Field label="Dot speed">
              <Segmented
                options={[
                  { value: "steady", label: "Steady" },
                  { value: "quick", label: "Quick" },
                ]}
                value={settings.speed}
                onChange={(v) => set("speed", v)}
              />
            </Field>
          </div>
          <p className="rounded-xl bg-background px-4 py-5 text-center text-sm text-muted">
            Hold <strong className="text-red-500">W A S D</strong> to drive the red dot and{" "}
            <strong className="text-blue-500">the arrow keys</strong> to drive the blue one, both at
            once. Each dot collects the ring of its own colour, and rings appear anywhere, so your
            paths will cross. Don&apos;t let the dots collide: a crash freezes both for a moment.
          </p>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.durationSec}s</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (!view) return null;
  const score = view.collected.left + view.collected.right;

  if (phase === "done") {
    const weaker = Math.min(view.collected.left, view.collected.right);
    const stronger = Math.max(view.collected.left, view.collected.right);
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Rings collected"
            value={score}
            best={best}
            meta={`${round.speed} · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Red (left)" value={view.collected.left} />
            <Stat label="Blue (right)" value={view.collected.right} />
            <Stat label="Crashes" value={view.bumps} />
            <Stat label="Balance" value={stronger ? `${Math.round((weaker / stronger) * 100)}%` : "—"} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            <span className="font-semibold text-foreground">Balance</span> compares your weaker hand
            with your stronger one. 100% means both hands pulled their weight equally.
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
            {Math.ceil(view.remaining)}s <span className="text-muted">left</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            {score} <span className="text-muted">rings</span>
          </span>
        </div>
        <ProgressBar value={view.remaining / round.durationSec} />
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-background">
          {HANDS.map((hand) => (
            <circle
              key={`t-${hand}`}
              cx={view.targets[hand].x}
              cy={view.targets[hand].y}
              r={TARGET_R}
              className={COLOR[hand]}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="2 1.5"
            />
          ))}
          {HANDS.map((hand) => (
            <circle
              key={`d-${hand}`}
              cx={view.dots[hand].x}
              cy={view.dots[hand].y}
              r={DOT_R}
              className={COLOR[hand]}
              fill="currentColor"
              opacity={view.stunned > 0 ? 0.4 : 1}
            />
          ))}
        </svg>
        <div className="flex justify-between gap-4">
          <Pad hand="left" held={held} />
          <Pad hand="right" held={held} />
        </div>
        <p className="text-center text-xs text-muted">
          Hold W A S D (red) and ← ↑ ↓ → (blue) together · Esc to exit
        </p>
      </div>
    </Card>
  );
}
