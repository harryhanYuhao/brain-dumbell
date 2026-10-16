"use client";

import { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, Stat } from "../components/ui";
import { ProblemView } from "./ProblemView";
import {
  NUMBER_TYPES,
  OPERATIONS,
  formatValue,
  generateProblem,
  problemToText,
  settingsKey,
  type Problem,
  type Settings,
} from "./problems";
import { eq, parseRational } from "./rational";
import { SettingsPanel } from "./SettingsPanel";
import { saveSettings, useSettings } from "./settings-store";

type Attempt = { problem: Problem; given: string; correct: boolean };
type Phase = "idle" | "playing" | "done";

const bestKey = (s: Settings) => `brain-dumbell:calculation-best:${settingsKey(s)}`;

function readBest(s: Settings) {
  try {
    return Number(localStorage.getItem(bestKey(s))) || 0;
  } catch {
    return 0;
  }
}

function saveBest(s: Settings, score: number) {
  try {
    localStorage.setItem(bestKey(s), String(score));
  } catch {
    // Storage unavailable (private mode etc.) — best score just isn't kept.
  }
}

function answerHint(s: Settings) {
  if (s.numberType === "fraction") return "Type a fraction like 7/12, -3/4 or 1 1/2";
  if (s.numberType === "decimal") return "Type a decimal like 3.25";
  return s.allowNegative ? "Use - for negative answers" : "";
}

function summary(s: Settings) {
  const ops = OPERATIONS.filter((o) => s.ops.includes(o.op))
    .map((o) => o.symbol)
    .join(" ");
  const type = NUMBER_TYPES.find((t) => t.value === s.numberType)?.label;
  return `${s.digits}-digit ${type?.toLowerCase()} · ${s.terms} numbers · ${ops} · ${s.durationSec}s`;
}

export function CalculationGame() {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>("idle");
  // Frozen copy for the running round, so the round and its score match.
  const [round, setRound] = useState<Settings>(settings);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [flash, setFlash] = useState<"right" | "wrong" | "invalid" | null>(null);
  const [best, setBest] = useState<{ score: number; isNew: boolean } | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const attemptsRef = useRef<Attempt[]>([]);

  useEffect(() => {
    if (phase !== "playing") return;
    const durationMs = round.durationSec * 1000;
    const endAt = performance.now() + durationMs;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        const score = attemptsRef.current.filter((x) => x.correct).length;
        const previous = readBest(round);
        if (score > previous) saveBest(round, score);
        setBest({ score: Math.max(score, previous), isNew: score > previous });
        setPhase("done");
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, round]);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase]);

  function start() {
    attemptsRef.current = [];
    setRound(settings);
    setAttempts([]);
    setAnswer("");
    setFlash(null);
    setBest(null);
    setRemaining(settings.durationSec * 1000);
    setProblem(generateProblem(settings));
    setPhase("playing");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (phase !== "playing" || !problem || answer.trim() === "") return;
    const value = parseRational(answer);
    if (!value) {
      setFlash("invalid");
      return;
    }
    const correct = eq(value, problem.answer);
    const next = [...attemptsRef.current, { problem, given: answer.trim(), correct }];
    attemptsRef.current = next;
    setAttempts(next);
    setFlash(correct ? "right" : "wrong");
    setAnswer("");
    setProblem(generateProblem(round));
  }

  const correctCount = attempts.filter((x) => x.correct).length;

  if (phase === "idle") {
    return (
      <Card>
        <SettingsPanel settings={settings} onChange={saveSettings} onStart={start} />
      </Card>
    );
  }

  if (phase === "done") {
    const mistakes = attempts.filter((x) => !x.correct);
    const accuracy = attempts.length
      ? Math.round((correctCount / attempts.length) * 100)
      : 0;
    return (
      <Card>
        <div className="flex flex-col items-center gap-8 py-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm uppercase tracking-widest text-muted">
              Correct answers
            </p>
            <p className="text-7xl font-bold tabular-nums">{correctCount}</p>
            {best?.isNew ? (
              <p className="font-medium text-accent">New personal best! 🎉</p>
            ) : (
              best && (
                <p className="text-sm text-muted">Personal best: {best.score}</p>
              )
            )}
            <p className="mt-2 text-xs text-muted">{summary(round)}</p>
          </div>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Attempted" value={attempts.length} />
            <Stat label="Accuracy" value={`${accuracy}%`} />
          </dl>
          {mistakes.length > 0 && (
            <div className="w-full max-w-md text-left">
              <p className="mb-2 text-sm font-medium text-muted">Mistakes</p>
              <ul className="flex flex-col gap-1 font-mono text-sm">
                {mistakes.map((m, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-4 rounded-md bg-red-500/10 px-3 py-1.5"
                  >
                    <span className="break-all">
                      {problemToText(m.problem, round.numberType)} ={" "}
                      {formatValue(m.problem.answer, round.numberType)}
                    </span>
                    <span className="text-red-600 line-through dark:text-red-400">
                      {m.given}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Try again</PrimaryButton>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="rounded-full border border-border px-6 py-3 font-semibold transition hover:border-accent"
            >
              Change settings
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const seconds = Math.ceil(remaining / 1000);
  const progress = remaining / (round.durationSec * 1000);
  const hint = answerHint(round);
  const needsText = round.numberType === "fraction" || round.allowNegative;

  return (
    <Card>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {seconds}s <span className="text-muted">left</span>
          </span>
          <span className="font-medium tabular-nums">
            {correctCount} <span className="text-muted">correct</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <form
          onSubmit={submit}
          className="flex flex-col items-center gap-6 py-6"
        >
          {problem && (
            <p className="flex flex-wrap items-center justify-center gap-x-3 text-center">
              <ProblemView
                key={attempts.length}
                problem={problem}
                numberType={round.numberType}
                className={problem.factors.length > 3 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"}
              />
              <span className="font-mono text-4xl font-bold text-muted sm:text-5xl">=</span>
            </p>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode={needsText ? "text" : round.numberType === "decimal" ? "decimal" : "numeric"}
            autoComplete="off"
            aria-label="Your answer"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value.replace(/[^0-9./\- −]/g, ""));
              if (flash === "invalid") setFlash(null);
            }}
            className={`w-48 rounded-xl border-2 bg-background px-4 py-3 text-center font-mono text-3xl tabular-nums outline-none transition-colors focus:border-accent ${
              flash === "right"
                ? "border-green-500"
                : flash === "wrong" || flash === "invalid"
                  ? "border-red-500"
                  : "border-border"
            }`}
          />
          <p className={`text-sm ${flash === "invalid" ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
            {flash === "invalid" ? "Couldn't read that answer. " : ""}
            {hint ? `${hint} · ` : ""}Enter to submit
          </p>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="text-xs text-muted hover:text-foreground"
          >
            Quit round
          </button>
        </form>
      </div>
    </Card>
  );
}
