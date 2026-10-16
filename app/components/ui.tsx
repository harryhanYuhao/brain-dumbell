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
