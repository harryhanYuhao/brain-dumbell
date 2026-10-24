"use client";

import { useState } from "react";
import { Field, PrimaryButton, Segmented, Stepper, Switch } from "../components/ui";
import { ProblemView } from "./ProblemView";
import {
  DEFAULT_SETTINGS,
  DIGIT_RANGE,
  DURATIONS,
  NUMBER_TYPES,
  OPERATIONS,
  TERM_RANGE,
  digitRange,
  generateProblem,
  seededRng,
  settingsKey,
  type Op,
  type Settings,
} from "./problems";

export function SettingsPanel({
  settings,
  onChange,
  onStart,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onStart: () => void;
}) {
  // The preview is seeded, so server and client render the same example.
  const [seed, setSeed] = useState(1);
  const example = generateProblem(settings, seededRng(seed));
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  function toggleOp(op: Op) {
    const has = settings.ops.includes(op);
    if (has && settings.ops.length === 1) return; // keep at least one
    set("ops", has ? settings.ops.filter((o) => o !== op) : [...settings.ops, op]);
  }

  const [lo, hi] = digitRange(settings.digits);
  const sizeHint =
    settings.numberType === "fraction"
      ? `Numerators and denominators ${lo}–${hi}`
      : settings.numberType === "decimal"
        ? `Like ${(lo / 10).toFixed(1)}–${(hi / 10).toFixed(1)}`
        : `Numbers ${lo}–${hi}`;
  const isDefault = settingsKey(settings) === settingsKey(DEFAULT_SETTINGS);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Digits per number" hint={sizeHint}>
          <Stepper
            value={settings.digits}
            range={DIGIT_RANGE}
            onChange={(v) => set("digits", v)}
            label="digits"
          />
        </Field>
        <Field
          label="Numbers per question"
          hint={
            settings.ops.length === 1 && settings.ops[0] === "^"
              ? "Exponent only: always one base and one power"
              : "An exponent counts as a number"
          }
        >
          <Stepper
            value={settings.terms}
            range={TERM_RANGE}
            onChange={(v) => set("terms", v)}
            label="numbers"
          />
        </Field>
        <Field label="Operations" hint="Usual order: powers, then × ÷, then + −" wide>
          <div className="flex flex-wrap gap-2">
            {OPERATIONS.map(({ op, label, symbol }) => {
              const on = settings.ops.includes(op);
              return (
                <button
                  key={op}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleOp(op)}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-accent bg-accent-soft text-foreground"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  <span className="w-5 font-mono font-bold text-accent">{symbol}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Number type">
          <Segmented
            options={NUMBER_TYPES}
            value={settings.numberType}
            onChange={(v) => set("numberType", v)}
          />
        </Field>
        <Field label="Time limit">
          <Segmented
            options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
            value={settings.durationSec}
            onChange={(v) => set("durationSec", v)}
          />
        </Field>
        <Field label="Negative answers" hint="When off, every answer is 0 or more">
          <Switch
            checked={settings.allowNegative}
            onChange={(v) => set("allowNegative", v)}
          >
            {settings.allowNegative ? "Allowed" : "Not allowed"}
          </Switch>
        </Field>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
          Example question
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded px-1.5 py-0.5 normal-case tracking-normal hover:bg-accent-soft hover:text-foreground"
          >
            ↻ another
          </button>
        </div>
        <ProblemView
          problem={example}
          numberType={settings.numberType}
          className="text-2xl sm:text-3xl"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <PrimaryButton onClick={onStart}>Start · {settings.durationSec}s</PrimaryButton>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="text-sm text-muted hover:text-foreground"
          >
            Reset to defaults
          </button>
        )}
      </div>
    </div>
  );
}
