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
const WINDOWS = [40, 80, 150] as const;

type Settings = { durationSec: number; windowMs: number };
const DEFAULTS: Settings = { durationSec: 60, windowMs: 80 };

const store = createStoredValue("brain-dumbell:chords-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    windowMs: pickOne(r.windowMs, WINDOWS, DEFAULTS.windowMs),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:chords-best:${s.durationSec}|${s.windowMs}`;

// Touch-typing halves of a QWERTY keyboard.
const KEYSET: Record<Hand, string> = { left: "qwertasdfgzxcvb", right: "yuiophjklnm" };

type Hand = "left" | "right";
type Chord = { keys: Record<Hand, string>; pressedAt: Record<Hand, number | null> };
/** `gap` is right press minus left press: positive means the left hand led. */
type Result = { gap: number; inSync: boolean; rt: number };
type Feedback = { text: string; ok: boolean; id: number };
type Phase = "idle" | "playing" | "done";

const HANDS = ["left", "right"] as const;
const COLOR: Record<Hand, string> = { left: "text-red-500", right: "text-blue-500" };

const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

function makeChord(previous?: Chord): Chord {
  let keys = { left: pick(KEYSET.left), right: pick(KEYSET.right) };
  while (previous && keys.left === previous.keys.left && keys.right === previous.keys.right) {
    keys = { left: pick(KEYSET.left), right: pick(KEYSET.right) };
  }
  return { keys, pressedAt: { left: null, right: null } };
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function KeyCap({ hand, letter, pressed }: { hand: Hand; letter: string; pressed: boolean }) {
  return (
    <span
      className={`grid size-24 place-items-center rounded-2xl border-4 border-current font-mono text-5xl font-bold uppercase transition sm:size-28 ${COLOR[hand]} ${
        pressed ? "translate-y-1 bg-current/15" : "bg-background shadow-[0_6px_0_currentColor]"
      }`}
    >
      {letter}
    </span>
  );
}

export function ChordsGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [chord, setChord] = useState<Chord | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  useEffect(() => {
    if (chord && chord.pressedAt.left === null && chord.pressedAt.right === null) {
      shownAt.current = performance.now();
    }
  }, [chord]);

  useEffect(() => {
    if (phase !== "playing") return;
    const endAt = performance.now() + round.durationSec * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        setBest(recordBest(bestKey(round), resultsRef.current.filter((r) => r.inSync).length));
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
    setFeedback(null);
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setChord(makeChord());
    setPhase("playing");
  }

  // `at` is the key event's timeStamp (same clock as performance.now()).
  function press(letter: string, at: number) {
    if (phase !== "playing" || !chord) return;
    const hand = HANDS.find((h) => chord.keys[h] === letter);
    if (!hand) {
      // A wrong letter spoils the chord: start it again from scratch.
      setErrors((n) => n + 1);
      setFeedback({ text: `Wrong key: ${letter.toUpperCase()}`, ok: false, id: at });
      setChord({ ...chord, pressedAt: { left: null, right: null } });
      return;
    }
    if (chord.pressedAt[hand] !== null) return;
    const pressedAt = { ...chord.pressedAt, [hand]: at };
    if (pressedAt.left === null || pressedAt.right === null) {
      setChord({ ...chord, pressedAt });
      return;
    }
    const gap = pressedAt.right - pressedAt.left;
    const inSync = Math.abs(gap) <= round.windowMs;
    resultsRef.current = [
      ...resultsRef.current,
      { gap, inSync, rt: Math.max(pressedAt.left, pressedAt.right) - shownAt.current },
    ];
    setResults(resultsRef.current);
    setFeedback({
      text: inSync
        ? `Together · ${Math.round(Math.abs(gap))} ms`
        : `Split by ${Math.round(Math.abs(gap))} ms · ${gap > 0 ? "left" : "right"} first`,
      ok: inSync,
      id: at,
    });
    setChord(makeChord(chord));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setPhase("idle");
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const letter = e.key.toLowerCase();
    if (letter.length !== 1 || !/[a-z]/.test(letter)) return;
    e.preventDefault();
    press(letter, e.timeStamp);
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
              label="Sync window"
              hint={`Both keys must go down within ${settings.windowMs} ms of each other`}
            >
              <Segmented
                options={[
                  { value: 40, label: "Tight" },
                  { value: 80, label: "Normal" },
                  { value: 150, label: "Loose" },
                ]}
                value={settings.windowMs}
                onChange={(v) => set("windowMs", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-4 rounded-xl bg-background px-4 py-6 text-center">
            <div className="flex items-center gap-4">
              <KeyCap hand="left" letter="f" pressed={false} />
              <span className="text-3xl text-muted">+</span>
              <KeyCap hand="right" letter="k" pressed={false} />
            </div>
            <p className="max-w-md text-sm text-muted">
              Press the <strong className="text-red-500">red</strong> letter with your left hand and the{" "}
              <strong className="text-blue-500">blue</strong> one with your right at exactly the same
              moment, like a piano chord. Needs a physical keyboard.
            </p>
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.durationSec}s</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const synced = results.filter((r) => r.inSync);
    const rate = results.length ? Math.round((synced.length / results.length) * 100) : 0;
    const lead = mean(results.map((r) => r.gap));
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const leadText =
      lead === null ? "—" : Math.abs(lead) < 5 ? "Even" : `${lead > 0 ? "Left" : "Right"} by ${Math.round(Math.abs(lead))} ms`;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Chords in sync"
            value={synced.length}
            best={best}
            meta={`±${round.windowMs} ms window · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Sync rate" value={`${rate}%`} />
            <Stat label="Avg. gap" value={ms(mean(results.map((r) => Math.abs(r.gap))))} />
            <Stat label="Leading hand" value={leadText} />
            <Stat label="Avg. per chord" value={ms(mean(results.map((r) => r.rt)))} />
            <Stat label="Chords played" value={results.length} />
            <Stat label="Wrong keys" value={errors} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            <span className="font-semibold text-foreground">Leading hand</span> shows which hand tends
            to jump the gun. Most people lead with their dominant hand.
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
            {results.filter((r) => r.inSync).length} <span className="text-muted">in sync</span>
          </span>
        </div>
        <ProgressBar value={remaining / (round.durationSec * 1000)} />
        {chord && (
          <div className="flex items-center justify-center gap-6 py-8">
            <KeyCap key={`l-${results.length}`} hand="left" letter={chord.keys.left} pressed={chord.pressedAt.left !== null} />
            <span className="text-3xl text-muted">+</span>
            <KeyCap key={`r-${results.length}`} hand="right" letter={chord.keys.right} pressed={chord.pressedAt.right !== null} />
          </div>
        )}
        <p
          key={feedback?.id}
          className={`text-center text-sm font-medium ${
            feedback === null ? "text-muted" : feedback.ok ? "text-green-600 dark:text-green-400" : "text-red-500"
          }`}
        >
          {feedback?.text ?? "Press both keys together"}
        </p>
        <p className="text-center text-xs text-muted">Esc to exit</p>
      </div>
    </Card>
  );
}
