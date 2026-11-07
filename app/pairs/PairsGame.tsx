"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  Card,
  ExitButton,
  Field,
  PrimaryButton,
  ResultHeadline,
  SecondaryButton,
  Segmented,
  Stat,
} from "../components/ui";
import { shuffle } from "../lib/random";
import { asRecord, createStoredValue, pickOne, recordBest } from "../lib/stored-value";

const SYMBOLS = ["🍎", "🚀", "🎲", "🌵", "🐙", "🎸", "⚽", "🌙", "🍩", "🦊", "🔑", "🎈"];
const PAIR_COUNTS = [6, 8, 10, 12] as const;
const MISMATCH_MS = 800;

type Settings = { pairs: number };
const DEFAULTS: Settings = { pairs: 8 };

const store = createStoredValue("brain-dumbell:pairs-settings", DEFAULTS, (raw) => {
  const r = asRecord(raw);
  return { pairs: pickOne(r.pairs, PAIR_COUNTS, DEFAULTS.pairs) };
});

const bestKey = (s: Settings) => `brain-dumbell:pairs-best:${s.pairs}`;

type Phase = "idle" | "playing" | "done";

const layout = (pairs: number) =>
  pairs <= 8
    ? "max-w-md grid-cols-4"
    : pairs === 10
      ? "max-w-lg grid-cols-4 sm:grid-cols-5"
      : "max-w-xl grid-cols-4 sm:grid-cols-6";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function PairsGame() {
  const settings = store.useValue();
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Settings>(settings);
  const [deck, setDeck] = useState<string[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<{ value: number; isNew: boolean } | null>(null);

  // A mismatched pair stays face up briefly, then turns back over.
  useEffect(() => {
    if (open.length !== 2) return;
    const id = setTimeout(() => setOpen([]), MISMATCH_MS);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (phase !== "playing" || startedAt === null) return;
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    setRound(settings);
    setDeck(shuffle(SYMBOLS.slice(0, settings.pairs).flatMap((s) => [s, s])));
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
    setStartedAt(null);
    setElapsed(0);
    setBest(null);
    setPhase("playing");
  }

  function flip(i: number, at: number) {
    if (phase !== "playing" || open.length === 2 || open.includes(i) || matched.has(i)) return;
    // The clock starts on the first card.
    const t0 = startedAt ?? at;
    if (startedAt === null) setStartedAt(at);
    if (open.length === 0) return setOpen([i]);

    const [first] = open;
    const count = moves + 1;
    setMoves(count);
    if (deck[first] !== deck[i]) return setOpen([first, i]);

    const next = new Set(matched).add(first).add(i);
    setMatched(next);
    setOpen([]);
    if (next.size === deck.length) {
      setElapsed(at - t0);
      setBest(recordBest(bestKey(round), count, true));
      setPhase("done");
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setPhase("idle");
  });

  useEffect(() => {
    if (phase !== "playing") return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle") {
    return (
      <Card>
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Pairs" hint={`${settings.pairs * 2} cards`}>
              <Segmented
                options={PAIR_COUNTS.map((n) => ({ value: n, label: String(n) }))}
                value={settings.pairs}
                onChange={(v) => store.save({ ...settings, pairs: v })}
              />
            </Field>
          </div>
          <p className="text-sm text-muted">
            A perfect memory needs only {settings.pairs} moves, but you can&apos;t know where
            anything is until you&apos;ve seen it. Around {settings.pairs * 2} moves is a strong
            result.
          </p>
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
            label="Moves"
            value={moves}
            best={best}
            meta={`${round.pairs} pairs`}
          />
          <dl className="grid w-full max-w-sm grid-cols-2 gap-4">
            <Stat label="Time" value={seconds(elapsed)} />
            <Stat label="Wasted moves" value={moves - round.pairs} />
          </dl>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={start}>Play again</PrimaryButton>
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
            {moves} <span className="text-muted">moves</span>
          </span>
          <ExitButton onClick={() => setPhase("idle")} />
          <span className="font-medium tabular-nums">
            {seconds(elapsed)}{" "}
            <span className="text-muted">
              · {matched.size / 2}/{round.pairs}
            </span>
          </span>
        </div>
        <div className={`mx-auto grid w-full gap-2 ${layout(round.pairs)}`}>
          {deck.map((symbol, i) => {
            const faceUp = open.includes(i) || matched.has(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={faceUp ? symbol : `Card ${i + 1}`}
                onPointerDown={(e) => {
                  if (e.button === 0) flip(i, e.timeStamp);
                }}
                className={`grid aspect-square touch-manipulation select-none place-items-center rounded-xl border-2 text-3xl transition-all duration-200 sm:text-4xl ${
                  matched.has(i)
                    ? "border-green-500/50 bg-green-500/10"
                    : faceUp
                      ? open.length === 2
                        ? "border-red-500/60 bg-surface"
                        : "border-accent bg-surface"
                      : "border-border bg-accent-soft hover:border-accent"
                }`}
              >
                <span className={`transition-transform duration-200 ${faceUp ? "scale-100" : "scale-0"}`}>
                  {symbol}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
