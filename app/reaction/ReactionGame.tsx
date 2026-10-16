"use client";

import { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, Stat } from "../components/ui";

const ROUNDS = 5;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 5000;

type Phase = "idle" | "waiting" | "go" | "early" | "result" | "done";

export function ReactionGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAtRef = useRef(0);

  useEffect(() => () => clearPending(), []);

  function clearPending() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  function beginRound() {
    clearPending();
    setPhase("waiting");
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timeoutRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
    }, delay);
  }

  function restart() {
    setTimes([]);
    beginRound();
  }

  function press() {
    switch (phase) {
      case "idle":
        restart();
        break;
      case "waiting":
        clearPending();
        setPhase("early");
        break;
      case "go": {
        const time = Math.round(performance.now() - goAtRef.current);
        const next = [...times, time];
        setTimes(next);
        setPhase(next.length >= ROUNDS ? "done" : "result");
        break;
      }
      case "early":
      case "result":
        beginRound();
        break;
    }
  }

  if (phase === "done") {
    const average = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">
              Average reaction time
            </p>
            <p className="text-7xl font-bold tabular-nums">
              {average}
              <span className="text-3xl text-muted"> ms</span>
            </p>
            <p className="text-sm text-muted">{verdict(average)}</p>
          </div>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Fastest" value={`${Math.min(...times)} ms`} />
            <Stat label="Slowest" value={`${Math.max(...times)} ms`} />
          </dl>
          <RoundList times={times} />
          <PrimaryButton onClick={restart}>Try again</PrimaryButton>
        </div>
      </Card>
    );
  }

  const panel = {
    idle: {
      className: "bg-accent text-white",
      title: "Click to start",
      hint: `${ROUNDS} rounds`,
    },
    waiting: {
      className: "bg-green-500 text-white",
      title: "Wait for red…",
      hint: "Don't click yet",
    },
    go: {
      className: "bg-red-500 text-white",
      title: "CLICK!",
      hint: "",
    },
    early: {
      className: "bg-amber-400 text-amber-950",
      title: "Too soon!",
      hint: "That round doesn't count. Click to try it again.",
    },
    result: {
      className: "bg-surface text-foreground border-2 border-border",
      title: `${times.at(-1)} ms`,
      hint: "Click to keep going",
    },
  }[phase];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium tabular-nums">
          Round {Math.min(times.length + 1, ROUNDS)}{" "}
          <span className="text-muted">of {ROUNDS}</span>
        </span>
        <RoundDots done={times.length} />
      </div>
      <button
        type="button"
        onPointerDown={(e) => {
          if (e.button === 0) press();
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        className={`flex h-80 w-full touch-manipulation select-none flex-col items-center justify-center gap-2 rounded-2xl outline-offset-4 sm:h-96 ${panel.className}`}
      >
        <span className="text-4xl font-bold sm:text-5xl">{panel.title}</span>
        {panel.hint && <span className="opacity-80">{panel.hint}</span>}
      </button>
      {times.length > 0 && <RoundList times={times} />}
    </div>
  );
}

function RoundDots({ done }: { done: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: ROUNDS }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full ${i < done ? "bg-accent" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function RoundList({ times }: { times: number[] }) {
  return (
    <ol className="flex flex-wrap justify-center gap-2 font-mono text-sm">
      {times.map((t, i) => (
        <li key={i} className="rounded-md bg-accent-soft px-3 py-1.5">
          <span className="text-muted">#{i + 1}</span> {t} ms
        </li>
      ))}
    </ol>
  );
}

function verdict(ms: number) {
  if (ms < 200) return "Lightning fast. ⚡";
  if (ms < 250) return "Faster than most people.";
  if (ms < 320) return "Right around average.";
  return "Room to improve — try again!";
}
