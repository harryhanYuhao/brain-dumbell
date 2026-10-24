import { createStoredValue } from "../lib/stored-value";

export type SchulteSettings = {
  size: number;
  markFound: boolean;
  reshuffle: boolean;
};

export const SIZE_RANGE = [3, 9] as const;

export const DEFAULT_SCHULTE: SchulteSettings = {
  size: 3,
  markFound: true,
  reshuffle: false,
};

function sanitize(raw: unknown): SchulteSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof SchulteSettings, unknown>
  >;
  const size =
    typeof r.size === "number" && Number.isInteger(r.size)
      ? Math.min(SIZE_RANGE[1], Math.max(SIZE_RANGE[0], r.size))
      : DEFAULT_SCHULTE.size;
  return {
    size,
    markFound: typeof r.markFound === "boolean" ? r.markFound : DEFAULT_SCHULTE.markFound,
    reshuffle: typeof r.reshuffle === "boolean" ? r.reshuffle : DEFAULT_SCHULTE.reshuffle,
  };
}

const store = createStoredValue("brain-dumbell:schulte-settings", DEFAULT_SCHULTE, sanitize);
export const useSchulteSettings = store.useValue;
export const saveSchulteSettings = store.save;

export const bestKey = (s: SchulteSettings) =>
  `brain-dumbell:schulte-best:${s.size}|${s.markFound ? "mark" : "nomark"}|${s.reshuffle ? "shuffle" : "fixed"}`;
