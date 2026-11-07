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
const LAYOUTS = ["fixed", "crossed"] as const;

type Settings = { durationSec: number; layout: (typeof LAYOUTS)[number] };
const DEFAULTS: Settings = { durationSec: 60, layout: "fixed" };

const store = createStoredValue("brain-dumbell:split-rules-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    layout: pickOne(r.layout, LAYOUTS, DEFAULTS.layout),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:split-rules-best:${s.durationSec}|${s.layout}`;

const VOWELS = "AEIOU";
const CONSONANTS = "BCDFGHKLMNPRSTVZ";

type Hand = "left" | "right";
type Choice = 0 | 1;
/** The left hand judges the number (odd/even), the right hand the letter (vowel/consonant). */
type Pair = {
  digit: number;
  letter: string;
  /** The number card shows on the right side of the screen. */
  swapped: boolean;
  answers: Record<Hand, boolean | null>;
};
type Result = { hand: Hand; correct: boolean; rt: number; swapped: boolean };
type Phase = "idle" | "playing" | "done";

const HANDS = ["left", "right"] as const;
const COLOR: Record<Hand, string> = { left: "text-red-500", right: "text-blue-500" };
const CHOICES: Record<Hand, [string, string]> = { left: ["Odd", "Even"], right: ["Vowel", "Consonant"] };
const KEY_LABEL: Record<Hand, [string, string]> = { left: ["A", "D"], right: ["←", "→"] };
const KEYS: Record<string, [Hand, Choice]> = {
  KeyA: ["left", 0],
  KeyD: ["left", 1],
  ArrowLeft: ["right", 0],
  ArrowRight: ["right", 1],
};

const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

function makePair(s: Settings): Pair {
  return {
    digit: 1 + Math.floor(Math.random() * 9),
    letter: Math.random() < 0.5 ? pick(VOWELS) : pick(CONSONANTS),
    swapped: s.layout === "crossed" && Math.random() < 0.5,
    answers: { left: null, right: null },
  };
}

function isRight(pair: Pair, hand: Hand, choice: Choice) {
  return hand === "left"
    ? (pair.digit % 2 === 0 ? 1 : 0) === choice
    : (VOWELS.includes(pair.letter) ? 0 : 1) === choice;
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function CardFace({ pair, hand }: { pair: Pair; hand: Hand }) {
  const answer = pair.answers[hand];
  return (
    <div
      className={`relative grid aspect-square w-full max-w-44 place-items-center rounded-2xl border-4 bg-background transition-colors ${
        answer === null ? "border-current" : answer ? "border-green-500/70" : "border-red-500/80"
      } ${COLOR[hand]}`}
    >
      <span className={`font-mono text-7xl font-bold ${answer === null ? "" : "opacity-30"}`}>
        {hand === "left" ? pair.digit : pair.letter}
      </span>
      {answer !== null && (
        <span className={`absolute text-5xl font-bold ${answer ? "text-green-500" : "text-red-500"}`}>
          {answer ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}

export function SplitRulesGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [pair, setPair] = useState<Pair | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  useEffect(() => {
    if (pair && pair.answers.left === null && pair.answers.right === null) {
      shownAt.current = performance.now();
    }
  }, [pair]);

  // Once both cards are answered, show the marks briefly, then deal the next pair.
  useEffect(() => {
    if (phase !== "playing" || !pair || pair.answers.left === null || pair.answers.right === null) return;
    const id = setTimeout(() => setPair(makePair(round)), 180);
    return () => clearTimeout(id);
  }, [phase, pair, round]);

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
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setPair(makePair(settings));
    setPhase("playing");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function answer(hand: Hand, choice: Choice, at: number) {
    if (phase !== "playing" || !pair || pair.answers[hand] !== null) return;
    const correct = isRight(pair, hand, choice);
    resultsRef.current = [
      ...resultsRef.current,
      { hand, correct, rt: at - shownAt.current, swapped: pair.swapped },
    ];
    setResults(resultsRef.current);
    setPair({ ...pair, answers: { ...pair.answers, [hand]: correct } });
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setPhase("idle");
      return;
    }
    const mapped = KEYS[e.code];
    if (!mapped) return;
    e.preventDefault();
    if (!e.repeat) answer(mapped[0], mapped[1], e.timeStamp);
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const rules = (
    <div className="grid gap-3 rounded-xl bg-background px-4 py-5 text-sm sm:grid-cols-2">
      {HANDS.map((hand) => (
        <p key={hand} className="text-center text-muted">
          <strong className={COLOR[hand]}>{hand === "left" ? "Number" : "Letter"}</strong> · {hand} hand
          <br />
          {CHOICES[hand].map((c, i) => (
            <span key={c} className="mx-1.5 inline-flex items-center gap-1">
              <kbd className="rounded border border-border px-1.5 font-mono text-xs text-foreground">
                {KEY_LABEL[hand][i]}
              </kbd>
              {c}
            </span>
          ))}
        </p>
      ))}
    </div>
  );

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
              label="Layout"
              hint={
                settings.layout === "fixed"
                  ? "The number is always on the left, the letter on the right"
                  : "The cards swap sides at random, but the number still belongs to your left hand"
              }
            >
              <Segmented
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "crossed", label: "Crossed" },
                ]}
                value={settings.layout}
                onChange={(v) => set("layout", v)}
              />
            </Field>
          </div>
          {rules}
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
    const ms = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ms`);
    const rt = (rs: Result[]) => mean(rs.map((r) => r.rt));
    const crossed = rt(correct.filter((r) => r.swapped));
    const straight = rt(correct.filter((r) => !r.swapped));
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Correct answers"
            value={correct.length}
            best={best}
            meta={`${round.layout} · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Avg. time" value={ms(rt(correct))} />
            <Stat label="Left (numbers)" value={ms(rt(correct.filter((r) => r.hand === "left")))} />
            <Stat label="Right (letters)" value={ms(rt(correct.filter((r) => r.hand === "right")))} />
          </dl>
          {round.layout === "crossed" && crossed !== null && straight !== null && (
            <p className="max-w-md text-sm text-muted">
              <span className="font-semibold text-foreground">
                Crossing cost: {crossed - straight >= 0 ? "+" : ""}
                {Math.round(crossed - straight)} ms
              </span>{" "}
              — the extra time when a card sat on the side of the wrong hand.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <SecondaryButton onClick={() => setPhase("idle")}>Change settings</SecondaryButton>
          </div>
        </div>
      </Card>
    );
  }

  const sides: Hand[] = pair?.swapped ? ["right", "left"] : ["left", "right"];
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
        {pair && (
          <div className="grid grid-cols-2 justify-items-center gap-4">
            {sides.map((hand) => (
              <CardFace key={hand} pair={pair} hand={hand} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {HANDS.map((hand) => (
            <div key={hand} className="grid grid-cols-2 gap-1.5">
              {CHOICES[hand].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onPointerDown={(e) => {
                    if (e.button === 0) answer(hand, i as Choice, e.timeStamp);
                  }}
                  className={`flex touch-manipulation select-none flex-col items-center rounded-xl border border-border bg-surface py-3 text-sm font-semibold transition-colors hover:border-accent active:bg-accent-soft ${COLOR[hand]}`}
                >
                  {label}
                  <kbd className="hidden font-mono text-xs text-muted sm:inline">{KEY_LABEL[hand][i]}</kbd>
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          Left hand: number A odd / D even · Right hand: letter ← vowel / → consonant · Esc to exit
        </p>
      </div>
    </Card>
  );
}
