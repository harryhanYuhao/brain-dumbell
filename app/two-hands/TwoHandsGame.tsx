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
const RULES = ["follow", "reverse"] as const;

type Settings = {
  durationSec: number;
  rule: (typeof RULES)[number];
};
const DEFAULTS: Settings = { durationSec: 30, rule: "follow" };

const store = createStoredValue("brain-dumbell:two-hands-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    rule: pickOne(r.rule, RULES, DEFAULTS.rule),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:two-hands-best:${s.durationSec}|${s.rule}`;

type Dir = "up" | "down" | "left" | "right";
type Hand = "left" | "right";
type Target = { dir: Dir; x: number; y: number; doneAt: number | null };
type Pair = Record<Hand, Target>;
/** Time each hand took to clear its arrow, from when the pair appeared. */
type Result = Record<Hand, number>;
type Phase = "idle" | "playing" | "done";

const DIRS: Dir[] = ["up", "right", "down", "left"];
const ROTATION: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

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
const KEY_LABEL: Record<Hand, Record<Dir, string>> = {
  left: { up: "W", left: "A", down: "S", right: "D" },
  right: { up: "↑", left: "←", down: "↓", right: "→" },
};

const HAND_STYLE: Record<Hand, { text: string; ring: string; name: string }> = {
  left: { text: "text-red-500", ring: "border-red-500/60", name: "Red" },
  right: { text: "text-blue-500", ring: "border-blue-500/60", name: "Blue" },
};

const randomDir = () => DIRS[Math.floor(Math.random() * DIRS.length)];

// Positions are % of the board. Keep arrows clear of the edges and of each other.
function makePair(): Pair {
  const spot = () => ({ x: 10 + Math.random() * 80, y: 15 + Math.random() * 70 });
  const a = spot();
  let b = spot();
  while (Math.hypot(a.x - b.x, (a.y - b.y) * 0.6) < 22) b = spot();
  return {
    left: { dir: randomDir(), ...a, doneAt: null },
    right: { dir: randomDir(), ...b, doneAt: null },
  };
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function Arrow({ dir, className }: { dir: Dir; className: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`size-14 sm:size-16 ${className}`}
      style={{ transform: `rotate(${ROTATION[dir]}deg)` }}
      aria-label={dir}
    >
      <path d="M20 4 L36 22 H26 V36 H14 V22 H4 Z" fill="currentColor" />
    </svg>
  );
}

function Pad({ hand, onPress }: { hand: Hand; onPress: (d: Dir, at: number) => void }) {
  const cell = (d: Dir, area: string) => (
    <button
      key={d}
      type="button"
      onPointerDown={(e) => {
        if (e.button === 0) onPress(d, e.timeStamp);
      }}
      style={{ gridArea: area }}
      className={`flex touch-manipulation select-none items-center justify-center rounded-lg border border-border bg-surface py-2 font-mono text-sm font-semibold transition-colors hover:border-accent active:bg-accent-soft ${HAND_STYLE[hand].text}`}
    >
      {KEY_LABEL[hand][d]}
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

export function TwoHandsGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [pair, setPair] = useState<Pair | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [errors, setErrors] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [miss, setMiss] = useState<{ hand: Hand; id: number } | null>(null);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  useEffect(() => {
    if (pair && pair.left.doneAt === null && pair.right.doneAt === null) {
      shownAt.current = performance.now();
    }
  }, [pair]);

  useEffect(() => {
    if (!miss) return;
    const id = setTimeout(() => setMiss(null), 250);
    return () => clearTimeout(id);
  }, [miss]);

  useEffect(() => {
    if (phase !== "playing") return;
    const endAt = performance.now() + round.durationSec * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        setBest(recordBest(bestKey(round), resultsRef.current.length));
        setPhase("done");
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, round]);

  function start() {
    resultsRef.current = [];
    setRound(settings);
    setResults([]);
    setErrors(0);
    setMiss(null);
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setPair(makePair());
    setPhase("playing");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function press(hand: Hand, dir: Dir, at: number) {
    if (phase !== "playing" || !pair) return;
    const target = pair[hand];
    if (target.doneAt !== null) return;
    const wanted = round.rule === "follow" ? target.dir : OPPOSITE[target.dir];
    if (dir !== wanted) {
      setErrors((n) => n + 1);
      setMiss({ hand, id: performance.now() });
      return;
    }
    const next: Pair = { ...pair, [hand]: { ...target, doneAt: at - shownAt.current } };
    if (next.left.doneAt !== null && next.right.doneAt !== null) {
      resultsRef.current = [...resultsRef.current, { left: next.left.doneAt, right: next.right.doneAt }];
      setResults(resultsRef.current);
      setPair(makePair());
    } else {
      setPair(next);
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setPhase("idle");
      return;
    }
    const mapped = KEYS[e.code];
    if (!mapped) return;
    e.preventDefault(); // Stop the arrow keys from scrolling the page.
    if (!e.repeat) press(mapped[0], mapped[1], e.timeStamp);
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
            <Field
              label="Rule"
              hint={
                settings.rule === "follow"
                  ? "Press the way each arrow points"
                  : "Press the opposite way to each arrow — much harder"
              }
            >
              <Segmented
                options={[
                  { value: "follow", label: "Follow" },
                  { value: "reverse", label: "Reverse" },
                ]}
                value={settings.rule}
                onChange={(v) => set("rule", v)}
              />
            </Field>
          </div>
          <div className="grid gap-3 rounded-xl bg-background px-4 py-6 text-center sm:grid-cols-2">
            {(["left", "right"] as const).map((hand) => (
              <div key={hand} className="flex flex-col items-center gap-2">
                <Arrow dir={hand === "left" ? "up" : "left"} className={HAND_STYLE[hand].text} />
                <span className="text-sm text-muted">
                  <strong className={HAND_STYLE[hand].text}>{HAND_STYLE[hand].name}</strong> ·{" "}
                  {hand} hand · press{" "}
                  <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">
                    {hand === "left"
                      ? KEY_LABEL.left[settings.rule === "follow" ? "up" : "down"]
                      : KEY_LABEL.right[settings.rule === "follow" ? "left" : "right"]}
                  </kbd>
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.durationSec}s</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const presses = results.length * 2 + errors;
    const accuracy = presses ? Math.round(((results.length * 2) / presses) * 100) : 0;
    const pairTime = mean(results.map((r) => Math.max(r.left, r.right)));
    const gap = mean(results.map((r) => Math.abs(r.left - r.right)));
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Pairs cleared"
            value={results.length}
            best={best}
            meta={`${round.rule} · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Avg. per pair" value={ms(pairTime)} />
            <Stat label="Left hand (red)" value={ms(mean(results.map((r) => r.left)))} />
            <Stat label="Right hand (blue)" value={ms(mean(results.map((r) => r.right)))} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            <span className="font-semibold text-foreground">Hand gap: {ms(gap)}</span> — how far
            apart your two hands finished on each pair. Smaller means they work in parallel rather
            than taking turns.
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
            {results.length} <span className="text-muted">pairs</span>
          </span>
        </div>
        <ProgressBar value={remaining / (round.durationSec * 1000)} />
        {pair && (
          <div className="relative h-72 overflow-hidden rounded-xl bg-background sm:h-80">
            {(["left", "right"] as const).map((hand) =>
              pair[hand].doneAt === null ? (
                <div
                  key={`${hand}-${results.length}`}
                  className={`absolute -translate-1/2 rounded-full border-2 p-1 transition-colors ${
                    miss?.hand === hand ? HAND_STYLE[hand].ring : "border-transparent"
                  }`}
                  style={{ left: `${pair[hand].x}%`, top: `${pair[hand].y}%` }}
                >
                  <Arrow dir={pair[hand].dir} className={HAND_STYLE[hand].text} />
                </div>
              ) : null,
            )}
          </div>
        )}
        <div className="flex justify-between gap-4">
          <Pad hand="left" onPress={(d, at) => press("left", d, at)} />
          <Pad hand="right" onPress={(d, at) => press("right", d, at)} />
        </div>
        <p className="text-center text-xs text-muted">
          Red: W A S D · Blue: ← ↑ ↓ → · {round.rule === "reverse" ? "press the opposite way · " : ""}
          Esc to exit
        </p>
      </div>
    </Card>
  );
}
