"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import {
  Card,
  ExitButton,
  Field,
  PrimaryButton,
  ResultHeadline,
  SecondaryButton,
  Segmented,
  Stat,
  Stepper,
} from "../components/ui";
import { asRecord, createStoredValue, pickInt, pickOne, recordBest } from "../lib/stored-value";

const DIRECTIONS = ["forward", "backward"] as const;
const SPEEDS = [
  { value: 1000, label: "Slow" },
  { value: 750, label: "Normal" },
  { value: 500, label: "Fast" },
] as const;
const START_RANGE = [2, 6] as const;
const MAX_SPAN = 16;

type Settings = {
  direction: (typeof DIRECTIONS)[number];
  stepMs: number;
  startSpan: number;
};
const DEFAULTS: Settings = { direction: "forward", stepMs: 750, startSpan: 3 };

const store = createStoredValue("brain-dumbell:digit-span-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    direction: pickOne(r.direction, DIRECTIONS, DEFAULTS.direction),
    stepMs: pickOne(r.stepMs, SPEEDS.map((s) => s.value), DEFAULTS.stepMs),
    startSpan: pickInt(r.startSpan, START_RANGE, DEFAULTS.startSpan),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:digit-span-best:${s.direction}|${s.stepMs}`;

type Phase = "idle" | "showing" | "input" | "feedback" | "done";

/** Random digits with no digit repeated back to back. */
function randomDigits(length: number) {
  const out: number[] = [];
  while (out.length < length) {
    const d = Math.floor(Math.random() * 10);
    if (d !== out.at(-1)) out.push(d);
  }
  return out;
}

export function DigitSpanGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [span, setSpan] = useState(settings.startSpan);
  const [attempt, setAttempt] = useState(1);
  const [digits, setDigits] = useState<number[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const [entry, setEntry] = useState<number[]>([]);
  const [passed, setPassed] = useState(false);
  const [longest, setLongest] = useState(0);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);

  // Show one digit at a time, with a short blank between so repeats are visible.
  useEffect(() => {
    if (phase !== "showing") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const on = Math.round(round.stepMs * 0.75);
    const lead = 600;
    digits.forEach((d, k) => {
      timers.push(setTimeout(() => setShown(k), lead + k * round.stepMs));
      timers.push(setTimeout(() => setShown(null), lead + k * round.stepMs + on));
    });
    timers.push(setTimeout(() => setPhase("input"), lead + digits.length * round.stepMs));
    return () => timers.forEach(clearTimeout);
  }, [phase, digits, round.stepMs]);

  const continueRun = useEffectEvent(() => {
    if (passed) {
      if (span >= MAX_SPAN) finish(span);
      else beginSequence(span + 1, 1);
    } else if (attempt === 1) {
      beginSequence(span, 2);
    } else {
      finish(longest);
    }
  });

  useEffect(() => {
    if (phase !== "feedback") return;
    const id = setTimeout(continueRun, 1800);
    return () => clearTimeout(id);
  }, [phase]);

  function beginSequence(length: number, attemptNo: number) {
    setSpan(length);
    setAttempt(attemptNo);
    setDigits(randomDigits(length));
    setEntry([]);
    setShown(null);
    setPhase("showing");
  }

  function start() {
    setRound(settings);
    setLongest(0);
    setBest(null);
    beginSequence(settings.startSpan, 1);
  }

  function finish(score: number) {
    setBest(recordBest(bestKey(round), score));
    setLongest(score);
    setPhase("done");
  }

  const expected = round.direction === "forward" ? digits : [...digits].reverse();

  function submit() {
    if (phase !== "input" || entry.length !== span) return;
    const ok = entry.every((d, i) => d === expected[i]);
    if (ok) setLongest(span);
    setPassed(ok);
    setPhase("feedback");
  }

  function press(d: number) {
    if (phase === "input" && entry.length < span) setEntry([...entry, d]);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") return setPhase("idle");
    if (phase !== "input") return;
    if (/^[0-9]$/.test(e.key)) press(Number(e.key));
    else if (e.key === "Backspace") setEntry(entry.slice(0, -1));
    else if (e.key === "Enter") submit();
  });

  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
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
              label="Direction"
              hint={
                settings.direction === "forward"
                  ? "Type the digits in the order shown"
                  : "Type them in reverse: last digit first"
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
            <Field label="Speed" hint={`${settings.stepMs / 1000}s per digit`}>
              <Segmented options={[...SPEEDS]} value={settings.stepMs} onChange={(v) => set("stepMs", v)} />
            </Field>
            <Field label="Starting length" hint={`First sequence has ${settings.startSpan} digits`}>
              <Stepper
                value={settings.startSpan}
                range={START_RANGE}
                onChange={(v) => set("startSpan", v)}
                label="digits"
              />
            </Field>
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
          <ResultHeadline
            label="Your digit span"
            value={longest}
            best={best}
            meta={`${round.direction} · ${SPEEDS.find((s) => s.value === round.stepMs)?.label.toLowerCase()}`}
          />
          <p className="max-w-md text-sm text-muted">
            Most adults hold about 7 digits forward and 5 backward. Chunking digits into pairs or
            triples, like a phone number, helps.
          </p>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Longest" value={`${longest} digits`} />
            <Stat label="Failed at" value={longest >= MAX_SPAN ? "—" : `${span} digits`} />
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
            {span} digits <span className="text-muted">· try {attempt} of 2</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
        </div>
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl bg-background sm:h-48">
          {phase === "showing" ? (
            <span className="font-mono text-8xl font-bold tabular-nums">
              {shown === null ? "" : digits[shown]}
            </span>
          ) : (
            <>
              <span
                className={`text-sm font-semibold ${
                  phase === "feedback"
                    ? passed
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                    : "text-accent"
                }`}
                aria-live="polite"
              >
                {phase === "input"
                  ? round.direction === "forward"
                    ? "Type the digits in order"
                    : "Type the digits in reverse"
                  : passed
                    ? "Correct!"
                    : `It was ${expected.join(" ")}`}
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: span }, (_, i) => (
                  <span
                    key={i}
                    className={`grid h-12 w-9 place-items-center rounded-lg border-2 font-mono text-2xl font-bold ${
                      i === entry.length && phase === "input" ? "border-accent" : "border-border"
                    }`}
                  >
                    {entry[i] ?? ""}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <KeyButton key={d} onClick={() => press(d)} disabled={phase !== "input"}>
              {d}
            </KeyButton>
          ))}
          <KeyButton onClick={() => setEntry(entry.slice(0, -1))} disabled={phase !== "input"}>
            ⌫
          </KeyButton>
          <KeyButton onClick={() => press(0)} disabled={phase !== "input"}>
            0
          </KeyButton>
          <KeyButton onClick={submit} disabled={phase !== "input" || entry.length !== span} accent>
            ✓
          </KeyButton>
        </div>
      </div>
    </Card>
  );
}

function KeyButton({
  onClick,
  disabled,
  accent,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`touch-manipulation rounded-xl border py-3 font-mono text-xl font-semibold transition-colors disabled:opacity-40 ${
        accent
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface enabled:hover:border-accent enabled:active:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}
