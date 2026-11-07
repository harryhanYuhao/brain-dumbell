import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-background px-4 py-3">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-accent px-8 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95"
    >
      {children}
    </button>
  );
}

export function Stepper({
  value,
  range: [min, max],
  onChange,
  label,
}: {
  value: number;
  range: readonly [number, number];
  onChange: (value: number) => void;
  label: string;
}) {
  const btn =
    "grid size-9 place-items-center text-lg text-muted transition-colors hover:bg-accent-soft hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex w-fit items-center overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={`Fewer ${label}`}
      >
        −
      </button>
      <span className="w-12 text-center font-mono text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`More ${label}`}
      >
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-lg border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            o.value === value
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="relative h-6 w-11 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
      {children}
    </label>
  );
}

export function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-6 py-3 font-semibold transition hover:border-accent"
    >
      {children}
    </button>
  );
}

/** Thin bar showing a 0–1 fraction, e.g. time left or progress. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

/** Small outlined button for leaving a round in progress. */
export function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-4 py-1 text-sm font-medium transition hover:border-accent"
    >
      Exit
    </button>
  );
}

/** The big number at the top of a results screen, with the personal best under it. */
export function ResultHeadline({
  label,
  value,
  best,
  meta,
}: {
  label: string;
  value: ReactNode;
  best: { value: ReactNode; isNew: boolean } | null;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm uppercase tracking-widest text-muted">{label}</p>
      <p className="text-7xl font-bold tabular-nums">{value}</p>
      {best?.isNew ? (
        <p className="font-medium text-accent">New personal best! 🎉</p>
      ) : (
        best && <p className="text-sm text-muted">Personal best: {best.value}</p>
      )}
      {meta && <p className="mt-2 text-xs text-muted">{meta}</p>}
    </div>
  );
}
