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

const RHYTHMS = ["1:2", "2:3", "3:4", "3:5"] as const;
const TEMPOS = ["slow", "medium", "fast"] as const;
const GUIDES = ["on", "count-in"] as const;

type Settings = {
  rhythm: (typeof RHYTHMS)[number];
  tempo: (typeof TEMPOS)[number];
  guide: (typeof GUIDES)[number];
};
const DEFAULTS: Settings = { rhythm: "2:3", tempo: "slow", guide: "on" };

const store = createStoredValue("brain-dumbell:polyrhythm-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    rhythm: pickOne(r.rhythm, RHYTHMS, DEFAULTS.rhythm),
    tempo: pickOne(r.tempo, TEMPOS, DEFAULTS.tempo),
    guide: pickOne(r.guide, GUIDES, DEFAULTS.guide),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:polyrhythm-best:${s.rhythm}|${s.tempo}|${s.guide}`;

/** Length of one full cycle (until both hands land together again), in ms. */
const CYCLE_MS: Record<Settings["tempo"], number> = { slow: 2400, medium: 1800, fast: 1300 };
const COUNT_IN = 2;
const CYCLES = 8;
/** A tap this close to its beat counts as on the beat. */
const ON_BEAT_MS = 70;
const PITCH: Record<Hand, number> = { left: 440, right: 880 };

type Hand = "left" | "right";
type Phase = "idle" | "playing" | "done";
type Round = Settings & { counts: Record<Hand, number>; cycleMs: number; t0: number };
/** Signed timing error for every scored beat, null if it was never tapped. */
type Beats = Record<Hand, (number | null)[]>;

const HANDS = ["left", "right"] as const;
const COLOR: Record<Hand, { text: string; bg: string }> = {
  left: { text: "text-red-500", bg: "bg-red-500" },
  right: { text: "text-blue-500", bg: "bg-blue-500" },
};

function parse(rhythm: Settings["rhythm"]): Record<Hand, number> {
  const [left, right] = rhythm.split(":").map(Number);
  return { left, right };
}

/** Whole-percent share of beats tapped within ±ON_BEAT_MS. */
function onBeatPercent(beats: Beats) {
  const all = [...beats.left, ...beats.right];
  const onBeat = all.filter((e) => e !== null && Math.abs(e) <= ON_BEAT_MS).length;
  return Math.round((onBeat / all.length) * 100);
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function click(ctx: AudioContext, out: AudioNode, at: number, freq: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(accent ? 0.5 : 0.3, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.07);
}

function Track({
  hand,
  count,
  progress,
  hits,
}: {
  hand: Hand;
  count: number;
  /** Position of the playhead in the current cycle, 0–1. */
  progress: number;
  hits: (number | null)[];
}) {
  return (
    <div className="relative h-12 rounded-lg bg-background">
      {Array.from({ length: count }, (_, k) => {
        const at = k / count;
        // Light up just after the playhead passes the beat.
        const lit = progress >= at && progress - at < 0.06;
        return (
          <span
            key={k}
            className={`absolute top-1/2 size-5 -translate-1/2 rounded-full transition-transform ${COLOR[hand].bg} ${
              lit ? "scale-150" : "opacity-40"
            }`}
            style={{ left: `${6 + at * 88}%` }}
          />
        );
      })}
      <span
        className="absolute inset-y-1 w-0.5 rounded bg-foreground/60"
        style={{ left: `${6 + progress * 88}%` }}
      />
      <span className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted tabular-nums">
        {hits.filter((h) => h !== null).length}/{hits.length}
      </span>
    </div>
  );
}

export function PolyrhythmGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(0);
  const [beats, setBeats] = useState<Beats>({ left: [], right: [] });
  const [extra, setExtra] = useState(0);
  const [lastTap, setLastTap] = useState<Record<Hand, number | null>>({ left: null, right: null });
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const audio = useRef<{ ctx: AudioContext; out: GainNode } | null>(null);
  const beatsRef = useRef<Beats>({ left: [], right: [] });

  const stopAudio = () => {
    audio.current?.out.disconnect();
    audio.current = null;
  };

  useEffect(() => stopAudio, []);

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const endAt = round.t0 + CYCLES * round.cycleMs;
    let raf = 0;
    const step = () => {
      const t = performance.now();
      setNow(t);
      // Allow late taps on the final beats before finishing.
      if (t > endAt + 250) {
        setBest(recordBest(bestKey(round), onBeatPercent(beatsRef.current)));
        stopAudio();
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, round]);

  function start() {
    stopAudio();
    const ctx = new AudioContext();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    audio.current = { ctx, out };

    const counts = parse(settings.rhythm);
    const cycleMs = CYCLE_MS[settings.tempo];
    const leadMs = 200;
    const audioStart = ctx.currentTime + leadMs / 1000;
    const guided = settings.guide === "on" ? COUNT_IN + CYCLES : COUNT_IN;
    for (let c = 0; c < guided; c++) {
      for (const hand of HANDS) {
        for (let k = 0; k < counts[hand]; k++) {
          const at = audioStart + (c * cycleMs + (k * cycleMs) / counts[hand]) / 1000;
          click(ctx, out, at, PITCH[hand], k === 0);
        }
      }
    }

    setRound({ ...settings, counts, cycleMs, t0: performance.now() + leadMs + COUNT_IN * cycleMs });
    beatsRef.current = {
      left: Array(counts.left * CYCLES).fill(null),
      right: Array(counts.right * CYCLES).fill(null),
    };
    setBeats(beatsRef.current);
    setExtra(0);
    setLastTap({ left: null, right: null });
    setBest(null);
    setNow(performance.now());
    setPhase("playing");
  }

  function exit() {
    stopAudio();
    setPhase("idle");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function tap(hand: Hand, at: number) {
    if (phase !== "playing" || !round) return;
    const interval = round.cycleMs / round.counts[hand];
    const index = Math.round((at - round.t0) / interval);
    if (index < 0) return; // Tapping along with the count-in is fine.
    const error = at - (round.t0 + index * interval);
    setLastTap((t) => ({ ...t, [hand]: error }));
    if (index >= beats[hand].length || beats[hand][index] !== null) {
      setExtra((n) => n + 1);
      return;
    }
    const b = beatsRef.current;
    beatsRef.current = { ...b, [hand]: b[hand].map((e, i) => (i === index ? error : e)) };
    setBeats(beatsRef.current);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") exit();
    else if (e.repeat) return;
    else if (e.code === "KeyF") tap("left", e.timeStamp);
    else if (e.code === "KeyJ") tap("right", e.timeStamp);
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
      store.save({ ...settings, [key]: value });
    const counts = parse(settings.rhythm);
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Rhythm"
              hint={`Left hand taps ${counts.left}, right hand taps ${counts.right} in the same time`}
            >
              <Segmented
                options={RHYTHMS.map((r) => ({ value: r, label: r.replace(":", " : ") }))}
                value={settings.rhythm}
                onChange={(v) => set("rhythm", v)}
              />
            </Field>
            <Field label="Tempo">
              <Segmented
                options={TEMPOS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
                value={settings.tempo}
                onChange={(v) => set("tempo", v)}
              />
            </Field>
            <Field
              label="Guide clicks"
              hint={
                settings.guide === "on"
                  ? "Clicks play all the way through"
                  : "Clicks stop after the count-in; keep the beat yourself"
              }
            >
              <Segmented
                options={[
                  { value: "on", label: "Always" },
                  { value: "count-in", label: "Count-in only" },
                ]}
                value={settings.guide}
                onChange={(v) => set("guide", v)}
              />
            </Field>
          </div>
          <p className="rounded-xl bg-background px-4 py-5 text-center text-sm text-muted">
            Turn your sound on. After a {COUNT_IN}-cycle count-in, tap{" "}
            <strong className="text-red-500">F</strong> with your left hand on the low clicks and{" "}
            <strong className="text-blue-500">J</strong> with your right on the high clicks, for {CYCLES}{" "}
            cycles.
          </p>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (!round) return null;

  if (phase === "done") {
    const all = [...beats.left, ...beats.right];
    const hit = (bs: (number | null)[]) => bs.filter((e): e is number => e !== null);
    const missed = all.length - hit(all).length;
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const drift = (hand: Hand) => {
      const d = mean(hit(beats[hand]));
      if (d === null) return "—";
      if (Math.abs(d) < 10) return "on time";
      return `${Math.round(Math.abs(d))} ms ${d < 0 ? "early" : "late"}`;
    };
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Beats on time"
            value={`${onBeatPercent(beats)}%`}
            best={best && { ...best, value: `${best.value}%` }}
            meta={`${round.rhythm} · ${round.tempo} · guide ${round.guide}`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Left error" value={ms(mean(hit(beats.left).map(Math.abs)))} />
            <Stat label="Right error" value={ms(mean(hit(beats.right).map(Math.abs)))} />
            <Stat label="Left tends" value={drift("left")} />
            <Stat label="Right tends" value={drift("right")} />
            <Stat label="Missed beats" value={missed} />
            <Stat label="Extra taps" value={extra} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            A beat is on time within ±{ON_BEAT_MS} ms. If one hand keeps drifting towards the other&apos;s
            beat, your hands are still syncing up instead of running independently.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const elapsed = now - round.t0;
  const countingIn = elapsed < 0;
  const cyclePos = elapsed + COUNT_IN * round.cycleMs;
  const progress = (cyclePos % round.cycleMs) / round.cycleMs;
  const cycle = Math.floor(cyclePos / round.cycleMs);
  const offset = (e: number | null) =>
    e === null ? " " : Math.abs(e) <= ON_BEAT_MS ? "on time" : `${Math.round(Math.abs(e))} ms ${e < 0 ? "early" : "late"}`;

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {countingIn ? (
              <>
                Count-in <span className="text-muted">{cycle + 1}/{COUNT_IN}</span>
              </>
            ) : (
              <>
                Cycle <span className="text-muted">{Math.min(CYCLES, cycle - COUNT_IN + 1)}/{CYCLES}</span>
              </>
            )}
          </span>
          <ExitButton onClick={exit} />
          <span className="font-medium tabular-nums">
            {round.rhythm} <span className="text-muted">{round.tempo}</span>
          </span>
        </div>
        <ProgressBar value={Math.max(0, elapsed) / (CYCLES * round.cycleMs)} />
        <div className="flex flex-col gap-3">
          {HANDS.map((hand) => (
            <Track key={hand} hand={hand} count={round.counts[hand]} progress={progress} hits={beats[hand]} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {HANDS.map((hand) => (
            <button
              key={hand}
              type="button"
              onPointerDown={(e) => {
                if (e.button === 0) tap(hand, e.timeStamp);
              }}
              className={`flex touch-manipulation select-none flex-col items-center gap-1 rounded-xl border border-border bg-surface py-6 transition-colors active:bg-accent-soft ${COLOR[hand].text}`}
            >
              <span className="text-2xl font-bold">{hand === "left" ? "F" : "J"}</span>
              <span className="text-xs text-muted">{offset(lastTap[hand])}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          {countingIn ? "Listen…" : "Tap along"} · Left: F (low) · Right: J (high) · Esc to exit
        </p>
      </div>
    </Card>
  );
}
