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
import { asRecord, createStoredValue, pickOne, readNumber, recordBest } from "../lib/stored-value";

const TRIAL_COUNTS = [30, 50, 80] as const;
const WINDOWS = [
  { value: 900, label: "Relaxed" },
  { value: 650, label: "Normal" },
  { value: 450, label: "Quick" },
] as const;
const NO_GO_SHARE = 0.3;
// Only runs at least this accurate can set a best time.
const BEST_MIN_ACCURACY = 0.9;

type Settings = { trials: number; windowMs: number };
const DEFAULTS: Settings = { trials: 50, windowMs: 650 };

const store = createStoredValue("brain-dumbell:go-no-go-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return {
    trials: pickOne(r.trials, TRIAL_COUNTS, DEFAULTS.trials),
    windowMs: pickOne(r.windowMs, WINDOWS.map((w) => w.value), DEFAULTS.windowMs),
  };
});

const bestKey = (s: Settings) => `brain-dumbell:go-no-go-best:${s.trials}|${s.windowMs}`;

type Kind = "go" | "nogo";
type Result = { kind: Kind; pressed: boolean; rt: number | null };
type Phase = "idle" | "playing" | "done";

function makeSchedule(count: number): Kind[] {
  const noGo = Math.round(count * NO_GO_SHARE);
  return shuffle([...Array<Kind>(noGo).fill("nogo"), ...Array<Kind>(count - noGo).fill("go")]);
}

const isCorrect = (r: Result) => (r.kind === "go") === r.pressed;

export function GoNoGoGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [schedule, setSchedule] = useState<Kind[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [flash, setFlash] = useState<boolean | null>(null);
  const [best, setBest] = useState<{ value: string; isNew: boolean } | null>(null);
  const shownAt = useRef(0);

  function finish(all: Result[]) {
    const hits = all.filter((r) => r.kind === "go" && r.pressed);
    const accuracy = all.filter(isCorrect).length / all.length;
    const avg = hits.length ? hits.reduce((a, r) => a + r.rt!, 0) / hits.length : null;
    const previous = readNumber(bestKey(round));
    if (avg !== null && accuracy >= BEST_MIN_ACCURACY) {
      const b = recordBest(bestKey(round), Math.round(avg), true);
      setBest({ value: `${b.value} ms`, isNew: b.isNew });
    } else {
      setBest(previous === null ? null : { value: `${previous} ms`, isNew: false });
    }
    setPhase("done");
  }

  function record(pressed: boolean, at: number) {
    const kind = schedule[index];
    const result: Result = { kind, pressed, rt: pressed ? at - shownAt.current : null };
    const next = [...results, result];
    setResults(next);
    setVisible(false);
    setFlash(isCorrect(result));
    if (next.length === schedule.length) finish(next);
    else setIndex(index + 1);
  }

  const expire = useEffectEvent(() => record(false, 0));

  // Each trial: a random blank pause, then the shape for a fixed window.
  useEffect(() => {
    if (phase !== "playing") return;
    const pause = 600 + Math.random() * 800;
    const show = setTimeout(() => {
      shownAt.current = performance.now();
      setVisible(true);
    }, pause);
    const end = setTimeout(expire, pause + round.windowMs);
    return () => {
      clearTimeout(show);
      clearTimeout(end);
    };
  }, [phase, index, round.windowMs]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), 250);
    return () => clearTimeout(id);
  }, [flash]);

  function start() {
    setRound(settings);
    setSchedule(makeSchedule(settings.trials));
    setIndex(0);
    setResults([]);
    setVisible(false);
    setFlash(null);
    setBest(null);
    setPhase("playing");
  }

  // `at` is the input event's timeStamp (same clock as performance.now()).
  function press(at: number) {
    if (phase === "playing" && visible) record(true, at);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") return setPhase("idle");
    if (e.key === " " && !e.repeat) {
      e.preventDefault();
      press(e.timeStamp);
    }
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
            <Field label="Trials" hint={`About ${Math.round(settings.trials * NO_GO_SHARE)} of them are STOP`}>
              <Segmented
                options={TRIAL_COUNTS.map((t) => ({ value: t, label: String(t) }))}
                value={settings.trials}
                onChange={(v) => set("trials", v)}
              />
            </Field>
            <Field label="Response window" hint={`Each shape stays up for ${settings.windowMs} ms`}>
              <Segmented options={[...WINDOWS]} value={settings.windowMs} onChange={(v) => set("windowMs", v)} />
            </Field>
          </div>
          <div className="flex justify-center gap-10 rounded-xl bg-background px-4 py-6 text-center text-sm text-muted">
            <div className="flex flex-col items-center gap-2">
              <Shape kind="go" small />
              <span>
                <strong className="text-foreground">Go</strong>: press
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shape kind="nogo" small />
              <span>
                <strong className="text-foreground">Stop</strong>: do nothing
              </span>
            </div>
          </div>
          <div className="flex justify-center">
            <PrimaryButton onClick={start}>Start · {settings.trials} trials</PrimaryButton>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "done") {
    const correct = results.filter(isCorrect).length;
    const hits = results.filter((r) => r.kind === "go" && r.pressed);
    const misses = results.filter((r) => r.kind === "go" && !r.pressed).length;
    const falseAlarms = results.filter((r) => r.kind === "nogo" && r.pressed).length;
    const avg = hits.length ? Math.round(hits.reduce((a, r) => a + r.rt!, 0) / hits.length) : null;
    const accuracy = Math.round((correct / results.length) * 100);
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <ResultHeadline
            label="Average go time"
            value={avg === null ? "—" : `${avg}`}
            best={best}
            meta={`${round.trials} trials · ${WINDOWS.find((w) => w.value === round.windowMs)?.label.toLowerCase()}`}
          />
          <dl className="grid w-full max-w-md grid-cols-2 gap-4">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Correct" value={`${correct} / ${results.length}`} />
            <Stat label="Pressed on STOP" value={falseAlarms} />
            <Stat label="Missed GO" value={misses} />
          </dl>
          <p className="max-w-md text-sm text-muted">
            Times are in milliseconds. Pressing on STOP is the error that matters most: it means
            the habit to press beat your brakes. Only runs with at least{" "}
            {BEST_MIN_ACCURACY * 100}% accuracy count towards your best.
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
            {results.length} <span className="text-muted">/ {schedule.length}</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
        </div>
        <ProgressBar value={results.length / schedule.length} />
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) press(e.timeStamp);
          }}
          className={`grid h-64 touch-manipulation select-none place-items-center rounded-xl border-2 bg-background transition-colors sm:h-72 ${
            flash === null ? "border-transparent" : flash ? "border-green-500/60" : "border-red-500/70"
          }`}
          aria-label="Press for GO"
        >
          {visible ? <Shape kind={schedule[index]} /> : <span className="text-3xl text-muted">+</span>}
        </button>
        <p className="text-center text-xs text-muted">
          Tap the box or press Space on GO · Esc to exit
        </p>
      </div>
    </Card>
  );
}

function Shape({ kind, small }: { kind: Kind; small?: boolean }) {
  const size = small ? "size-14" : "size-36 sm:size-40";
  return kind === "go" ? (
    <span className={`${size} rounded-full bg-green-500`} />
  ) : (
    <span
      className={`${size} grid place-items-center bg-red-500 font-black tracking-wider text-white ${
        small ? "text-xs" : "text-3xl"
      }`}
      style={{ clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)" }}
    >
      STOP
    </span>
  );
}
