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
import { shuffle } from "../lib/random";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

// Abstract glyphs on a 24 × 24 grid, drawn as strokes.
const GLYPHS = [
  "M6 6 H18 V18",
  "M12 4 L20 19 H4 Z",
  "M4 12 Q12 2 20 12 Q12 22 4 12",
  "M7 4 V20 M7 12 H18",
  "M4 8 H20 M4 16 H20 M12 8 V16",
  "M20 12 A8 8 0 1 1 4 12 A8 8 0 1 1 20 12 M12 10.5 V13.5",
  "M5 18 L12 6 L19 18",
  "M6 6 L18 18 M6 18 H18",
  "M4 12 C8 3 16 21 20 12",
];
const DURATIONS = [60, 90, 120] as const;
const KEYS = ["shuffled", "fixed"] as const;
const PREVIEW = 4;

type Settings = { durationSec: number; key: (typeof KEYS)[number] };
const DEFAULTS: Settings = { durationSec: 90, key: "shuffled" };

const store = createStoredValue("brain-dumbell:symbol-digit-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    durationSec: pickOne(r.durationSec, DURATIONS, DEFAULTS.durationSec),
    key: pickOne(r.key, KEYS, DEFAULTS.key),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:symbol-digit-best:${s.durationSec}|${s.key}`;

type Phase = "idle" | "playing" | "done";
type Result = { correct: boolean; rt: number };

const IDENTITY = GLYPHS.map((_, i) => i);

/** A run of glyph indices with no glyph twice in a row. */
function extend(queue: number[], length: number) {
  const out = [...queue];
  while (out.length < length) {
    const g = Math.floor(Math.random() * GLYPHS.length);
    if (g !== out.at(-1)) out.push(g);
  }
  return out;
}

function Glyph({ index, className }: { index: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d={GLYPHS[index]}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeyTable({
  mapping,
  onPick,
}: {
  mapping: number[];
  onPick?: (digit: number, at: number) => void;
}) {
  return (
    <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
      {mapping.map((glyph, i) => (
        <button
          key={i}
          type="button"
          disabled={!onPick}
          onPointerDown={(e) => {
            if (e.button === 0) onPick?.(i + 1, e.timeStamp);
          }}
          className="flex touch-manipulation select-none flex-col items-center gap-1 rounded-lg border border-border bg-surface py-2 transition-colors enabled:hover:border-accent enabled:active:bg-accent-soft"
        >
          <Glyph index={glyph} className="size-6 sm:size-8" />
          <span className="font-mono text-base font-bold sm:text-lg">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

export function SymbolDigitGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  // mapping[digit - 1] is the glyph for that digit.
  const [mapping, setMapping] = useState<number[]>(IDENTITY);
  const [queue, setQueue] = useState<number[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; id: number } | null>(null);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);
  const shownAt = useRef(0);
  const resultsRef = useRef<Result[]>([]);

  useEffect(() => {
    if (phase === "playing") shownAt.current = performance.now();
  }, [phase, results.length]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 200);
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
    setMapping(settings.key === "shuffled" ? shuffle(IDENTITY) : IDENTITY);
    setQueue(extend([], PREVIEW + 1));
    setResults([]);
    setFlash(null);
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setPhase("playing");
  }

  function answer(digit: number, at: number) {
    if (phase !== "playing") return;
    const result = { correct: mapping[digit - 1] === queue[0], rt: at - shownAt.current };
    resultsRef.current = [...resultsRef.current, result];
    setResults(resultsRef.current);
    setFlash({ ok: result.correct, id: resultsRef.current.length });
    setQueue(extend(queue.slice(1), PREVIEW + 1));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") return setPhase("idle");
    if (!e.repeat && /^[1-9]$/.test(e.key)) answer(Number(e.key), e.timeStamp);
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
              label="Key"
              hint={
                settings.key === "shuffled"
                  ? "Symbols get new digits every run, so you must keep checking the key"
                  : "Same key every run, so you can learn it by heart"
              }
            >
              <Segmented
                options={[
                  { value: "shuffled", label: "Shuffled" },
                  { value: "fixed", label: "Fixed" },
                ]}
                value={settings.key}
                onChange={(v) => set("key", v)}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-background p-4">
            <span className="text-center text-xs uppercase tracking-wider text-muted">
              The key{settings.key === "shuffled" ? " (example)" : ""}
            </span>
            <KeyTable mapping={mapping} />
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
            label="Symbols matched"
            value={correct.length}
            best={best}
            meta={`${round.key} key · ${round.durationSec}s`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Avg. time" value={avg === null ? "—" : `${Math.round(avg)} ms`} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            This is a version of the Symbol Digit Modalities Test, a standard measure of
            processing speed. Early answers are slow while you scan the key; watch how much faster
            you get once a few pairs stick.
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
        <KeyTable mapping={mapping} onPick={answer} />
        <div
          className={`flex h-40 items-center justify-center gap-4 rounded-xl border-2 bg-background transition-colors sm:gap-6 ${
            flash === null ? "border-transparent" : flash.ok ? "border-green-500/60" : "border-red-500/70"
          }`}
        >
          {queue.slice(0, PREVIEW + 1).map((g, i) => (
            <Glyph
              key={results.length + i}
              index={g}
              className={i === 0 ? "size-20 text-foreground sm:size-24" : "size-8 text-muted opacity-60 sm:size-10"}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted">
          Press the digit for the big symbol (keys 1–9, or tap the key) · Esc to exit
        </p>
      </div>
    </Card>
  );
}
