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

const PACES = ["calm", "brisk", "fast"] as const;
type Pace = (typeof PACES)[number];

type Settings = { pace: Pace };
const DEFAULTS: Settings = { pace: "calm" };

const store = createStoredValue("brain-dumbell:twin-lanes-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return { pace: pickOne(r.pace, PACES, DEFAULTS.pace) };
});

const bestKey = (s: Settings) => `brain-dumbell:twin-lanes-best:${s.pace}`;

// Board units: 400 × 600. Each hand owns one half with two lanes.
const W = 400;
const H = 600;
const CAR_Y = 530;
const START_SPEED: Record<Pace, number> = { calm: 200, brisk: 260, fast: 330 };
const MAX_SPEED = 560;
const ACCEL = 5; // speed gained per second
const LIVES = 3;
// Distance between consecutive objects in one half.
const GAP_MIN = 150;
const GAP_RANGE = 120;

type Hand = "left" | "right";
type Lane = 0 | 1;
type Thing = { id: number; hand: Hand; lane: Lane; y: number; kind: "coin" | "block" };
type World = {
  cars: Record<Hand, Lane>;
  things: Thing[];
  nextSpawn: Record<Hand, number>;
  speed: number;
  elapsed: number;
  lives: number;
  caught: Record<Hand, number>;
  /** `elapsed` when each half last lost a life, for the red flash. */
  hurtAt: Record<Hand, number>;
  nextId: number;
};
type Phase = "idle" | "playing" | "done";

const HANDS = ["left", "right"] as const;
const COLOR: Record<Hand, string> = { left: "text-red-500", right: "text-blue-500" };
const laneX = (hand: Hand, lane: Lane) => (hand === "left" ? 0 : W / 2) + 50 + lane * 100;
const randomLane = (): Lane => (Math.random() < 0.5 ? 0 : 1);

function newWorld(pace: Pace): World {
  return {
    cars: { left: 0, right: 1 },
    things: [],
    nextSpawn: { left: 0.4, right: 0.9 },
    speed: START_SPEED[pace],
    elapsed: 0,
    lives: LIVES,
    caught: { left: 0, right: 0 },
    hurtAt: { left: -1, right: -1 },
    nextId: 0,
  };
}

const snapshot = (w: World): World => ({
  ...w,
  cars: { ...w.cars },
  things: w.things.map((t) => ({ ...t })),
  caught: { ...w.caught },
  hurtAt: { ...w.hurtAt },
});

function Board({ world, onTap }: { world: World; onTap?: (hand: Hand, lane: Lane) => void }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto aspect-[2/3] h-[min(60svh,34rem)] touch-manipulation select-none rounded-xl bg-background"
      onPointerDown={(e) => {
        if (!onTap) return;
        const box = e.currentTarget.getBoundingClientRect();
        const quarter = Math.min(3, Math.floor(((e.clientX - box.left) / box.width) * 4));
        onTap(quarter < 2 ? "left" : "right", (quarter % 2) as Lane);
      }}
    >
      {HANDS.map((hand) => (
        <g key={hand} className={COLOR[hand]}>
          <rect
            x={hand === "left" ? 0 : W / 2}
            width={W / 2}
            height={H}
            fill="currentColor"
            opacity={world.elapsed - world.hurtAt[hand] < 0.3 && world.hurtAt[hand] >= 0 ? 0.25 : 0.05}
          />
          <line
            x1={laneX(hand, 0) + 50}
            x2={laneX(hand, 0) + 50}
            y1={0}
            y2={H}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeDasharray="12 14"
            strokeWidth={2}
          />
        </g>
      ))}
      <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.3} strokeWidth={3} />
      {world.things.map((t) =>
        t.kind === "coin" ? (
          <circle key={t.id} cx={laneX(t.hand, t.lane)} cy={t.y} r={18} className={COLOR[t.hand]} fill="currentColor" />
        ) : (
          <rect
            key={t.id}
            x={laneX(t.hand, t.lane) - 17}
            y={t.y - 17}
            width={34}
            height={34}
            rx={4}
            className={COLOR[t.hand]}
            fill="none"
            stroke="currentColor"
            strokeWidth={7}
          />
        ),
      )}
      {HANDS.map((hand) => (
        <g
          key={hand}
          className={COLOR[hand]}
          style={{
            transform: `translate(${laneX(hand, world.cars[hand])}px, ${CAR_Y}px)`,
            transition: "transform 70ms",
          }}
        >
          <rect x={-22} y={-30} width={44} height={60} rx={12} fill="currentColor" />
          <rect x={-14} y={-20} width={28} height={14} rx={4} fill="white" opacity={0.7} />
        </g>
      ))}
    </svg>
  );
}

export function TwinLanesGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [view, setView] = useState<World | null>(null);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const world = useRef<World>(newWorld(settings.pace));

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = world.current;
      w.elapsed += dt;
      w.speed = Math.min(MAX_SPEED, w.speed + ACCEL * dt);
      for (const hand of HANDS) {
        w.nextSpawn[hand] -= dt;
        if (w.nextSpawn[hand] <= 0) {
          w.things.push({
            id: w.nextId++,
            hand,
            lane: randomLane(),
            y: -30,
            kind: Math.random() < 0.5 ? "coin" : "block",
          });
          w.nextSpawn[hand] = (GAP_MIN + Math.random() * GAP_RANGE) / w.speed;
        }
      }
      const hurt = (hand: Hand) => {
        w.lives -= 1;
        w.hurtAt[hand] = w.elapsed;
      };
      w.things = w.things.filter((t) => {
        t.y += w.speed * dt;
        if (t.lane === w.cars[t.hand] && Math.abs(t.y - CAR_Y) < 45) {
          if (t.kind === "coin") w.caught[t.hand] += 1;
          else hurt(t.hand);
          return false;
        }
        if (t.y > H + 30) {
          if (t.kind === "coin") hurt(t.hand);
          return false;
        }
        return true;
      });
      setView(snapshot(w));
      if (w.lives <= 0) {
        setBest(recordBest(bestKey(round), w.caught.left + w.caught.right));
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, round]);

  function start() {
    world.current = newWorld(settings.pace);
    setRound(settings);
    setView(snapshot(world.current));
    setBest(null);
    setPhase("playing");
  }

  function steer(hand: Hand, lane: Lane) {
    if (phase === "playing") world.current.cars[hand] = lane;
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setPhase("idle");
    else if (e.code === "KeyA") steer("left", 0);
    else if (e.code === "KeyD") steer("left", 1);
    else if (e.code === "ArrowLeft") steer("right", 0);
    else if (e.code === "ArrowRight") steer("right", 1);
    else return;
    e.preventDefault();
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <Field
            label="Starting pace"
            hint="Everything speeds up the longer you survive, whichever pace you start at."
          >
            <Segmented
              options={PACES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
              value={settings.pace}
              onChange={(pace) => store.save({ ...settings, pace })}
            />
          </Field>
          <div className="grid gap-4 rounded-xl bg-background px-4 py-6 text-sm text-muted sm:grid-cols-2">
            <p>
              <strong className="text-red-500">Red car</strong> · left hand ·{" "}
              <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">A</kbd>{" "}
              <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">D</kbd>
            </p>
            <p>
              <strong className="text-blue-500">Blue car</strong> · right hand ·{" "}
              <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">←</kbd>{" "}
              <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">→</kbd>
            </p>
            <p className="sm:col-span-2">
              Catch every <strong className="text-foreground">circle</strong>, dodge every{" "}
              <strong className="text-foreground">square</strong>. Missing a circle or hitting a square
              costs one of your {LIVES} lives.
            </p>
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (!view) return null;
  const score = view.caught.left + view.caught.right;

  if (phase === "done") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline label="Circles caught" value={score} best={best} meta={`${round.pace} start`} />
          <dl className="grid w-full max-w-md grid-cols-3 gap-4">
            <Stat label="Survived" value={`${view.elapsed.toFixed(1)}s`} />
            <Stat label="Red (left)" value={view.caught.left} />
            <Stat label="Blue (right)" value={view.caught.right} />
          </dl>
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {"♥".repeat(view.lives)}
            <span className="text-muted">{"♡".repeat(LIVES - view.lives)}</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            {score} <span className="text-muted">caught</span>
          </span>
        </div>
        <Board world={view} onTap={steer} />
        <p className="text-center text-xs text-muted">
          Red: A D · Blue: ← → · or tap a lane · Esc to exit
        </p>
      </div>
    </Card>
  );
}
