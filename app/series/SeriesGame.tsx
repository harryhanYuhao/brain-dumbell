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

const LEVELS = ["easy", "medium", "hard"] as const;
type Level = (typeof LEVELS)[number];
const QUESTION_COUNTS = [10, 20] as const;

type Settings = { level: Level; questions: number };
const DEFAULTS: Settings = { level: "medium", questions: 10 };

const store = createStoredValue("brain-dumbell:series-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    level: pickOne(r.level, LEVELS, DEFAULTS.level),
    questions: pickOne(r.questions, QUESTION_COUNTS, DEFAULTS.questions),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:series-best:${s.level}|${s.questions}`;

type Puzzle = { terms: number[]; answer: number; rule: string };
type Phase = "idle" | "playing" | "done";

const int = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

/** Builds a series from a start value and a step rule; shows `shown` terms. */
function iterate(start: number, step: (prev: number, i: number) => number, shown = 5) {
  const terms = [start];
  for (let i = 1; i <= shown; i++) terms.push(step(terms[i - 1], i));
  return { terms: terms.slice(0, shown), answer: terms[shown] };
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];

const GENERATORS: Record<Level, (() => Puzzle)[]> = {
  easy: [
    () => {
      const d = int(2, 9);
      return { ...iterate(int(1, 20), (p) => p + d), rule: `${signed(d)} each time` };
    },
    () => {
      const d = int(3, 9);
      return { ...iterate(int(50, 99), (p) => p - d), rule: `${signed(-d)} each time` };
    },
    () => ({ ...iterate(int(1, 6), (p) => p * 2), rule: "×2 each time" }),
    () => {
      const d = int(11, 25);
      return { ...iterate(int(1, 30), (p) => p + d), rule: `${signed(d)} each time` };
    },
  ],
  medium: [
    () => {
      const d = int(1, 4);
      const s = int(1, 3);
      return {
        ...iterate(int(1, 15), (p, i) => p + d + s * (i - 1)),
        rule: `The gap grows by ${s}: ${signed(d)}, ${signed(d + s)}, ${signed(d + 2 * s)}…`,
      };
    },
    () => ({ ...iterate(int(1, 4), (p) => p * 3), rule: "×3 each time" }),
    () => {
      const a = int(4, 9);
      const b = int(1, a - 1);
      return {
        ...iterate(int(1, 20), (p, i) => (i % 2 ? p + a : p - b)),
        rule: `Alternately ${signed(a)} and ${signed(-b)}`,
      };
    },
    () => {
      const k = int(1, 7);
      const terms = Array.from({ length: 6 }, (_, i) => (k + i) ** 2);
      return { terms: terms.slice(0, 5), answer: terms[5], rule: `Square numbers: ${k}², ${k + 1}², ${k + 2}²…` };
    },
    () => {
      const half = int(1, 3) * 16 * 2 ** int(0, 2);
      return { ...iterate(half * 2, (p) => p / 2), rule: "Halved each time" };
    },
  ],
  hard: [
    () => {
      const b = int(1, 9);
      const terms = [int(1, 9), b];
      while (terms.length < 7) terms.push(terms.at(-1)! + terms.at(-2)!);
      return { terms: terms.slice(0, 6), answer: terms[6], rule: "Each number is the sum of the two before it" };
    },
    () => {
      const c = [1, -1, 2, 3][int(0, 3)];
      return { ...iterate(int(1, 5), (p) => 2 * p + c), rule: `Double, then ${signed(c)}` };
    },
    () => {
      const d = int(1, 3);
      return {
        ...iterate(int(1, 10), (p, i) => p + d * 2 ** (i - 1)),
        rule: `The gap doubles: ${signed(d)}, ${signed(2 * d)}, ${signed(4 * d)}…`,
      };
    },
    () => {
      // Two series interleaved: odd positions step by p, even ones by q.
      const p = int(2, 6);
      const q = -int(1, 5);
      const a = int(1, 9);
      const b = int(20, 40);
      const terms = Array.from({ length: 7 }, (_, i) => (i % 2 ? b + q * ((i - 1) / 2) : a + p * (i / 2)));
      return {
        terms: terms.slice(0, 6),
        answer: terms[6],
        rule: `Two series take turns: one goes ${signed(p)}, the other ${signed(q)}`,
      };
    },
    () => {
      const a = int(2, 3);
      const b = int(1, 4);
      return {
        ...iterate(int(1, 6), (p, i) => (i % 2 ? p * a : p + b)),
        rule: `Alternately ×${a} and ${signed(b)}`,
      };
    },
    () => {
      const k = int(0, PRIMES.length - 7);
      return { terms: PRIMES.slice(k, k + 5), answer: PRIMES[k + 5], rule: "Prime numbers in order" };
    },
    () => {
      const k = int(1, 4);
      const terms = Array.from({ length: 6 }, (_, i) => (k + i) ** 3);
      return { terms: terms.slice(0, 5), answer: terms[5], rule: `Cube numbers: ${k}³, ${k + 1}³, ${k + 2}³…` };
    },
  ],
};

function makePuzzle(level: Level, prev: Puzzle | null): Puzzle {
  for (;;) {
    const pool = GENERATORS[level];
    const p = pool[Math.floor(Math.random() * pool.length)]();
    if (!prev || prev.rule !== p.rule) return p;
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function SeriesGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [asked, setAsked] = useState(0);
  const [score, setScore] = useState(0);
  const [entry, setEntry] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const startedAt = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "playing" && !feedback) input.current?.focus();
  }, [phase, feedback]);

  function start() {
    setRound(settings);
    setPuzzle(makePuzzle(settings.level, null));
    setAsked(1);
    setScore(0);
    setEntry("");
    setFeedback(null);
    setBest(null);
    startedAt.current = performance.now();
    setPhase("playing");
  }

  function check(skip = false) {
    if (!puzzle || feedback) return;
    const value = Number(entry.replace("−", "-"));
    if (!skip && (entry.trim() === "" || Number.isNaN(value))) return;
    const correct = !skip && value === puzzle.answer;
    if (correct) setScore(score + 1);
    setFeedback({ correct });
  }

  function next() {
    if (asked >= round.questions) {
      setElapsed(performance.now() - startedAt.current);
      setBest(recordBest(bestKey(round), score));
      setPhase("done");
      return;
    }
    setPuzzle(makePuzzle(round.level, puzzle));
    setAsked(asked + 1);
    setEntry("");
    setFeedback(null);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setPhase("idle");
    else if (e.key === "Enter" && feedback) next();
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
              label="Difficulty"
              hint={
                settings.level === "easy"
                  ? "Steady steps: add, subtract or double"
                  : settings.level === "medium"
                    ? "Growing gaps, alternating steps, squares"
                    : "Fibonacci-style sums, interleaved series, primes, cubes"
              }
            >
              <Segmented
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ]}
                value={settings.level}
                onChange={(v) => set("level", v)}
              />
            </Field>
            <Field label="Questions">
              <Segmented
                options={QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
                value={settings.questions}
                onChange={(v) => set("questions", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-background px-4 py-6 text-center">
            <span className="text-xs uppercase tracking-wider text-muted">Example</span>
            <span className="font-mono text-2xl font-bold">2, 5, 9, 14, 20, ?</span>
            <span className="text-sm text-muted">
              The answer is <strong className="text-foreground">27</strong>: the gap grows by 1
              each time.
            </span>
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.questions} questions</PrimaryButton>
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
            label="Correct answers"
            value={`${score}/${round.questions}`}
            best={best && { ...best, value: `${best.value}/${round.questions}` }}
            meta={`${round.level} · ${round.questions} questions`}
          />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Total time" value={seconds(elapsed)} />
            <Stat label="Per question" value={seconds(elapsed / round.questions)} />
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            Question {asked} <span className="text-muted">/ {round.questions}</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            {score} <span className="text-muted">correct</span>
          </span>
        </div>
        <ProgressBar value={(asked - (feedback ? 0 : 1)) / round.questions} />
        {puzzle && (
          <div
            className={`flex flex-col items-center gap-4 rounded-xl border-2 bg-background px-4 py-8 text-center transition-colors ${
              feedback === null ? "border-transparent" : feedback.correct ? "border-green-500/60" : "border-red-500/70"
            }`}
          >
            <p className="font-mono text-2xl font-bold tabular-nums sm:text-4xl">
              {puzzle.terms.join(", ")}, <span className="text-accent">?</span>
            </p>
            {feedback ? (
              <div className="flex flex-col items-center gap-1" aria-live="polite">
                <p
                  className={`font-semibold ${
                    feedback.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {feedback.correct ? "Correct!" : `The answer was ${puzzle.answer}`}
                </p>
                <p className="text-sm text-muted">{puzzle.rule}</p>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  check();
                }}
              >
                <input
                  ref={input}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value.replace(/[^0-9\-−]/g, ""))}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Next number"
                  className="w-32 rounded-lg border-2 border-border bg-surface px-3 py-2 text-center font-mono text-2xl font-bold outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 font-semibold text-white transition hover:opacity-90"
                >
                  Check
                </button>
              </form>
            )}
          </div>
        )}
        <div className="flex justify-center">
          {feedback ? (
            <PrimaryButton onClick={next}>
              {asked >= round.questions ? "See results" : "Next"} <span className="text-white/70">↵</span>
            </PrimaryButton>
          ) : (
            <SecondaryButton onClick={() => check(true)}>Skip</SecondaryButton>
          )}
        </div>
      </div>
    </Card>
  );
}
