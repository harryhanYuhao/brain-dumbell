"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import {
  Card,
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

const N_RANGE = [1, 5] as const;
const SPEEDS = [
  { value: 2500, label: "Slow" },
  { value: 2000, label: "Normal" },
  { value: 1500, label: "Fast" },
  { value: 1000, label: "Fastest" },
] as const;
const MODES = ["single", "dual"] as const;
const STIMULUS_MS = 500;
const LEAD_IN_MS = 1200;
const TARGET_RATE = 0.3;
const BASE_TRIALS = 20;

// The 8 outer cells of a 3 × 3 grid; the centre holds a fixation cross.
const POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8];
// Letters that are hard to confuse when spoken.
const LETTERS = ["C", "H", "K", "L", "Q", "R", "S", "T"];

type Channel = "position" | "sound";
type Settings = { n: number; intervalMs: number; mode: (typeof MODES)[number] };
const DEFAULTS: Settings = { n: 2, intervalMs: 2000, mode: "single" };

const store = createStoredValue("brain-dumbell:nback-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    n: pickInt(r.n, N_RANGE, DEFAULTS.n),
    intervalMs: pickOne(r.intervalMs, SPEEDS.map((s) => s.value), DEFAULTS.intervalMs),
    mode: pickOne(r.mode, MODES, DEFAULTS.mode),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:nback-best:${s.n}|${s.mode}|${s.intervalMs}`;

type Round = {
  settings: Settings;
  positions: number[];
  letters: number[];
};
type Responses = Record<Channel, boolean>[];
type Phase = "idle" | "playing" | "done";

/**
 * Random sequence where exactly TARGET_RATE of the scorable items repeat the
 * one n back, so every round has a fair number of matches.
 */
function makeSequence(length: number, n: number, choices: number) {
  const scorable = Array.from({ length: length - n }, (_, i) => i + n);
  for (let i = scorable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scorable[i], scorable[j]] = [scorable[j], scorable[i]];
  }
  const targets = new Set(scorable.slice(0, Math.round(scorable.length * TARGET_RATE)));
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    if (targets.has(i)) {
      seq.push(seq[i - n]);
    } else {
      let v: number;
      do v = Math.floor(Math.random() * choices);
      while (i >= n && v === seq[i - n]);
      seq.push(v);
    }
  }
  return seq;
}

const subscribeNoop = () => () => {};

function speak(letter: string) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(letter);
    u.rate = 1.1;
    speechSynthesis.speak(u);
  } catch {
    // No speech support — dual mode is disabled in the UI in that case.
  }
}

type ChannelScore = { hits: number; misses: number; falseAlarms: number; accuracy: number };

function scoreChannel(seq: number[], n: number, responses: Responses, channel: Channel): ChannelScore {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let right = 0;
  for (let i = 0; i < seq.length; i++) {
    const isTarget = i >= n && seq[i] === seq[i - n];
    const pressed = responses[i]?.[channel] ?? false;
    if (isTarget && pressed) hits++;
    if (isTarget && !pressed) misses++;
    if (!isTarget && pressed) falseAlarms++;
    if (i >= n && isTarget === pressed) right++;
  }
  return { hits, misses, falseAlarms, accuracy: right / (seq.length - n) };
}

export function NBackGame() {
  const settings = store.useValue();
  const speechOk = useSyncExternalStore(subscribeNoop, () => "speechSynthesis" in window, () => true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Round | null>(null);
  const [index, setIndex] = useState(-1);
  const [stimOn, setStimOn] = useState(false);
  const [responses, setResponses] = useState<Responses>([]);
  const [feedback, setFeedback] = useState<Partial<Record<Channel, "hit" | "wrong">>>({});
  const [best, setBest] = useState<{ accuracy: number; isNew: boolean } | null>(null);
  const responsesRef = useRef<Responses>([]);

  const channels: Channel[] =
    round?.settings.mode === "dual" ? ["position", "sound"] : ["position"];

  function start(s: Settings = settings) {
    const mode = s.mode === "dual" && !speechOk ? "single" : s.mode;
    const effective = { ...s, mode };
    const length = BASE_TRIALS + s.n;
    responsesRef.current = Array.from({ length }, () => ({ position: false, sound: false }));
    setRound({
      settings: effective,
      positions: makeSequence(length, s.n, POSITIONS.length),
      letters: makeSequence(length, s.n, LETTERS.length),
    });
    setResponses(responsesRef.current);
    setIndex(-1);
    setStimOn(false);
    setFeedback({});
    setBest(null);
    setPhase("playing");
  }

  const advance = useEffectEvent(() => {
    if (!round) return;
    const next = index + 1;
    if (next >= round.positions.length) {
      const scores = channels.map((c) =>
        scoreChannel(c === "position" ? round.positions : round.letters, round.settings.n, responsesRef.current, c),
      );
      const accuracy = Math.round((scores.reduce((a, s) => a + s.accuracy, 0) / scores.length) * 100);
      const key = bestKey(round.settings);
      const previous = readNumber(key) ?? 0;
      if (accuracy > previous) writeNumber(key, accuracy);
      setBest({ accuracy: Math.max(accuracy, previous), isNew: accuracy > previous });
      setPhase("done");
      return;
    }
    setIndex(next);
    setStimOn(true);
    setFeedback({});
    if (round.settings.mode === "dual") speak(LETTERS[round.letters[next]]);
  });

  // Drives the sequence: show each stimulus briefly, then move on.
  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const hide = setTimeout(() => setStimOn(false), STIMULUS_MS);
    const next = setTimeout(() => advance(), index < 0 ? LEAD_IN_MS : round.settings.intervalMs);
    return () => {
      clearTimeout(hide);
      clearTimeout(next);
    };
  }, [phase, round, index]);

  useEffect(() => {
    if (phase !== "playing") window.speechSynthesis?.cancel();
  }, [phase]);

  function respond(channel: Channel) {
    if (phase !== "playing" || !round || index < 0) return;
    if (!channels.includes(channel) || responsesRef.current[index][channel]) return;
    const seq = channel === "position" ? round.positions : round.letters;
    const isTarget = index >= round.settings.n && seq[index] === seq[index - round.settings.n];
    responsesRef.current = responsesRef.current.map((r, i) => (i === index ? { ...r, [channel]: true } : r));
    setResponses(responsesRef.current);
    setFeedback((f) => ({ ...f, [channel]: isTarget ? "hit" : "wrong" }));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === "a") respond("position");
    if (key === "l") respond("sound");
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle" || !round) {
    const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
      store.save({ ...settings, [key]: value });
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="N (steps back)" hint={`Match against the item ${settings.n} step${settings.n > 1 ? "s" : ""} ago`}>
              <Stepper value={settings.n} range={N_RANGE} onChange={(v) => set("n", v)} label="steps back" />
            </Field>
            <Field label="Speed" hint={`A new item every ${settings.intervalMs / 1000}s`}>
              <Segmented options={[...SPEEDS]} value={settings.intervalMs} onChange={(v) => set("intervalMs", v)} />
            </Field>
            <Field
              label="Mode"
              hint={
                !speechOk
                  ? "Dual mode needs speech, which this browser doesn't support"
                  : settings.mode === "dual"
                    ? "Positions and spoken letters at the same time; turn your sound on"
                    : "Positions only"
              }
              wide
            >
              <Segmented
                options={[
                  { value: "single", label: "Single (position)" },
                  { value: "dual", label: "Dual (position + sound)" },
                ]}
                value={speechOk ? settings.mode : "single"}
                onChange={(v) => set("mode", v)}
              />
            </Field>
          </div>
          <Explainer n={settings.n} />
          <div className="flex justify-center">
            <PrimaryButton onClick={() => start()}>Start · {BASE_TRIALS + settings.n} items</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const n = round.settings.n;

  if (phase === "done") {
    const scores = channels.map((c) => ({
      channel: c,
      ...scoreChannel(c === "position" ? round.positions : round.letters, n, responses, c),
    }));
    const accuracy = Math.round((scores.reduce((a, s) => a + s.accuracy, 0) / scores.length) * 100);
    const canUp = accuracy >= 80 && n < N_RANGE[1];
    const canDown = accuracy < 50 && n > N_RANGE[0];
    const restartAt = (newN: number) => {
      const s = { ...round.settings, n: newN };
      store.save(s);
      start(s);
    };
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">Accuracy at {n}-back</p>
            <p className="text-7xl font-bold tabular-nums">{accuracy}%</p>
            {best?.isNew ? (
              <p className="font-medium text-accent">New personal best! 🎉</p>
            ) : (
              best && <p className="text-sm text-muted">Personal best: {best.accuracy}%</p>
            )}
            <p className="mt-2 text-xs text-muted">
              {round.settings.mode} · {SPEEDS.find((s) => s.value === round.settings.intervalMs)?.label.toLowerCase()}
            </p>
          </div>
          {scores.map((s) => (
            <div key={s.channel} className="flex w-full max-w-md flex-col gap-2">
              {scores.length > 1 && (
                <p className="text-left text-sm font-medium capitalize text-muted">{s.channel}</p>
              )}
              <dl className="grid grid-cols-3 gap-3">
                <Stat label="Hits" value={s.hits} />
                <Stat label="Missed" value={s.misses} />
                <Stat label="False alarms" value={s.falseAlarms} />
              </dl>
            </div>
          ))}
          <p className="max-w-md text-sm text-muted">
            {canUp
              ? `80% or better: you're ready for ${n + 1}-back.`
              : canDown
                ? `Under 50%: try ${n - 1}-back for a while, then come back.`
                : accuracy >= 80
                  ? "Top level, top marks. Impressive."
                  : "Keep training at this level until you reach 80%."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {canUp && <PrimaryButton onClick={() => restartAt(n + 1)}>Try {n + 1}-back</PrimaryButton>}
            {canDown && <PrimaryButton onClick={() => restartAt(n - 1)}>Try {n - 1}-back</PrimaryButton>}
            {canUp || canDown ? (
              <SecondaryButton onClick={() => start(round.settings)}>Repeat {n}-back</SecondaryButton>
            ) : (
              <PrimaryButton onClick={() => start(round.settings)}>Try again</PrimaryButton>
            )}
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const total = round.positions.length;
  const activeCell = stimOn && index >= 0 ? POSITIONS[round.positions[index]] : null;
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {index < 0 ? "Get ready…" : <>Item {index + 1} <span className="text-muted">of {total}</span></>}
          </span>
          <span className="font-semibold text-accent">{n}-back</span>
        </div>
        <ProgressBar value={(index + 1) / total} />
        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2" style={{ maxWidth: "min(20rem, 45svh)" }}>
          {Array.from({ length: 9 }, (_, cell) => (
            <div
              key={cell}
              className={`grid aspect-square place-items-center rounded-xl border transition-colors duration-100 ${
                cell === activeCell ? "border-accent bg-accent" : "border-border bg-background"
              }`}
            >
              {cell === 4 && <span className="text-2xl text-muted">+</span>}
            </div>
          ))}
        </div>
        <div className={`grid gap-3 ${channels.length > 1 ? "grid-cols-2" : "mx-auto w-full max-w-xs grid-cols-1"}`}>
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              onPointerDown={(e) => {
                if (e.button === 0) respond(c);
              }}
              disabled={index < 0}
              className={`flex touch-manipulation select-none flex-col items-center rounded-xl border-2 py-4 font-semibold transition-colors disabled:opacity-50 ${
                feedback[c] === "hit"
                  ? "border-green-500 bg-green-500/15"
                  : feedback[c] === "wrong"
                    ? "border-red-500 bg-red-500/15"
                    : "border-border bg-surface hover:border-accent"
              }`}
            >
              <span className="text-lg capitalize">{c} match</span>
              <span className="hidden text-xs font-normal text-muted sm:block">
                key {c === "position" ? "A" : "L"}
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPhase("idle")} className="mx-auto text-xs text-muted hover:text-foreground">
          Quit round
        </button>
      </div>
    </Card>
  );
}

/** Small worked example of what counts as a match. */
function Explainer({ n }: { n: number }) {
  // First and last are in the same cell, n steps apart.
  const sample = [3, ...[5, 0, 7, 1].slice(0, n - 1), 3];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-6 text-center">
      <span className="text-xs uppercase tracking-wider text-muted">{n}-back example</span>
      <div className="flex flex-wrap items-end justify-center gap-3">
        {sample.map((cell, i) => {
          const match = i === n;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={`grid grid-cols-3 gap-0.5 rounded-md p-1 ${match ? "ring-2 ring-green-500" : ""}`}>
                {Array.from({ length: 9 }, (_, c) => (
                  <span key={c} className={`size-2.5 rounded-[2px] ${c === cell ? "bg-accent" : "bg-border"}`} />
                ))}
              </div>
              <span className={`text-xs ${match ? "font-semibold text-green-600 dark:text-green-400" : "text-muted"}`}>
                {match ? "match!" : `#${i + 1}`}
              </span>
            </div>
          );
        })}
      </div>
      <span className="max-w-sm text-sm text-muted">
        #{n + 1} is in the same place as #1, {n} step{n > 1 ? "s" : ""} earlier, so you press Position.
      </span>
    </div>
  );
}
