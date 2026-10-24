import {
  add,
  div,
  format,
  isInteger,
  isNegative,
  mul,
  pow,
  rat,
  sub,
  type Rational,
} from "./rational";
import type { Rng } from "../lib/random";

export type Op = "+" | "-" | "×" | "÷" | "^";
type BinaryOp = Exclude<Op, "^">;
export type NumberType = "integer" | "decimal" | "fraction";

export type Settings = {
  digits: number;
  terms: number;
  ops: Op[];
  numberType: NumberType;
  allowNegative: boolean;
  durationSec: number;
};

export const DEFAULT_SETTINGS: Settings = {
  digits: 2,
  terms: 2,
  ops: ["+", "-"],
  numberType: "integer",
  allowNegative: false,
  durationSec: 20,
};

export const DIGIT_RANGE = [1, 6] as const;
export const TERM_RANGE = [2, 8] as const;
export const DURATIONS = [15, 20, 30, 60, 120];

export const OPERATIONS: { op: Op; label: string; symbol: string }[] = [
  { op: "+", label: "Addition", symbol: "+" },
  { op: "-", label: "Subtraction", symbol: "−" },
  { op: "×", label: "Multiplication", symbol: "×" },
  { op: "÷", label: "Division", symbol: "÷" },
  { op: "^", label: "Exponent", symbol: "xⁿ" },
];

export const NUMBER_TYPES: { value: NumberType; label: string }[] = [
  { value: "integer", label: "Integers" },
  { value: "decimal", label: "Decimals" },
  { value: "fraction", label: "Fractions" },
];

/** A number in the expression, optionally raised to a small power. */
export type Factor = { value: Rational; exp?: number };

/** factors[i] and factors[i + 1] are joined by ops[i]. */
export type Problem = { factors: Factor[]; ops: BinaryOp[]; answer: Rational };

export { seededRng, type Rng } from "../lib/random";

function randInt(rng: Rng, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function digitRange(digits: number): [number, number] {
  return [digits === 1 ? 1 : 10 ** (digits - 1), 10 ** digits - 1];
}

function randomOperand(s: Settings, rng: Rng): Rational {
  const [lo, hi] = digitRange(s.digits);
  for (;;) {
    if (s.numberType === "fraction") {
      // Numerator and denominator each have `digits` digits; skip whole numbers.
      const value = rat(randInt(rng, lo, hi), randInt(rng, Math.max(lo, 2), hi));
      if (!isInteger(value)) return value;
    } else if (s.numberType === "decimal") {
      // One decimal place: 2 digits → 1.0–9.9; skip values like 4.0.
      const n = randInt(rng, lo, hi);
      if (n % 10 !== 0) return rat(n, 10);
    } else {
      return rat(randInt(rng, lo, hi));
    }
  }
}

function factorValue(f: Factor) {
  return f.exp ? pow(f.value, f.exp) : f.value;
}

/** Evaluates with the usual precedence: powers, then × ÷, then + − left to right. */
export function evaluate(factors: Factor[], ops: BinaryOp[]): Rational {
  const terms = [factorValue(factors[0])];
  const addOps: BinaryOp[] = [];
  ops.forEach((op, i) => {
    const v = factorValue(factors[i + 1]);
    const last = terms.length - 1;
    if (op === "×") terms[last] = mul(terms[last], v);
    else if (op === "÷") terms[last] = div(terms[last], v);
    else {
      addOps.push(op);
      terms.push(v);
    }
  });
  return addOps.reduce(
    (acc, op, i) => (op === "+" ? add : sub)(acc, terms[i + 1]),
    terms[0],
  );
}

function generateOnce(s: Settings, rng: Rng): Problem {
  const factors: Factor[] = [{ value: randomOperand(s, rng) }];
  const ops: BinaryOp[] = [];
  let prev: Op | null = null;
  // Every operation consumes one more number (an exponent counts as a number).
  for (let i = 1; i < s.terms; i++) {
    // No stacked powers (3^2^3) and no powers as divisors (÷ 58²).
    const choices = s.ops.filter((op) => !(op === "^" && (prev === "^" || prev === "÷")));
    if (choices.length === 0) break;
    const op = pick(rng, choices);
    if (op === "^") {
      // Cubes only for small bases — 37³ is not mental maths.
      const base = factors[factors.length - 1];
      const small = base.value.n <= 12n && base.value.d <= 12n;
      base.exp = small ? randInt(rng, 2, 3) : 2;
    } else {
      ops.push(op);
      factors.push({ value: randomOperand(s, rng) });
    }
    prev = op;
  }

  // Integer and decimal answers must come out exact, so for each division,
  // scale an earlier multiplied factor in the same product by the divisor:
  // 6 × 4 ÷ 3 becomes (6·3) × 4 ÷ 3 = 18 × 4 ÷ 3.
  if (s.numberType !== "fraction") {
    ops.forEach((op, i) => {
      if (op !== "÷") return;
      const divisor = factorValue(factors[i + 1]);
      for (let j = i; j >= 0; j--) {
        const joinedBy = j === 0 ? null : ops[j - 1];
        const multiplied = joinedBy === null || joinedBy === "×" || joinedBy === "+" || joinedBy === "-";
        if (multiplied && !factors[j].exp) {
          factors[j].value = mul(factors[j].value, divisor);
          return;
        }
        // Reached the start of this product without a usable factor.
        if (joinedBy !== "×" && joinedBy !== "÷") break;
      }
      ops[i] = "×";
    });
  }

  return { factors, ops, answer: evaluate(factors, ops) };
}

export function generateProblem(s: Settings, rng: Rng = Math.random): Problem {
  let problem = generateOnce(s, rng);
  for (let tries = 0; !s.allowNegative && isNegative(problem.answer) && tries < 20; tries++) {
    problem = generateOnce(s, rng);
  }
  // Still negative (e.g. a long run of subtractions): enlarge the first
  // number so the answer becomes a positive operand-sized number.
  const first = problem.factors[0];
  const firstStandsAlone = !first.exp && (problem.ops[0] === undefined || problem.ops[0] === "+" || problem.ops[0] === "-");
  if (!s.allowNegative && isNegative(problem.answer) && firstStandsAlone) {
    first.value = add(first.value, sub(randomOperand(s, rng), problem.answer));
    problem.answer = evaluate(problem.factors, problem.ops);
  }
  return problem;
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const OP_TEXT: Record<BinaryOp, string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };

export function formatValue(value: Rational, type: NumberType) {
  return format(value, type === "fraction" ? "fraction" : "decimal");
}

/** Plain-text rendering, e.g. "(3/4)² + 1/2". */
export function problemToText(p: Problem, type: NumberType) {
  return p.factors
    .map((f, i) => {
      let text = formatValue(f.value, type);
      const op = i === 0 ? null : p.ops[i - 1];
      if (!isInteger(f.value) && type === "fraction" && (f.exp || op === "÷")) {
        text = `(${text})`;
      }
      if (f.exp) text += [...String(f.exp)].map((d) => SUPERSCRIPT[+d]).join("");
      return op ? `${OP_TEXT[op]} ${text}` : text;
    })
    .join(" ");
}

export function settingsKey(s: Settings) {
  const ops = OPERATIONS.map((o) => o.op).filter((op) => s.ops.includes(op));
  return [s.digits, s.terms, ops.join(""), s.numberType, s.allowNegative ? "neg" : "pos", s.durationSec].join("|");
}

export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  const clampInt = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) =>
    typeof v === "number" && Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  const validOps = OPERATIONS.map((o) => o.op);
  const ops = Array.isArray(r.ops) ? validOps.filter((op) => (r.ops as unknown[]).includes(op)) : [];
  return {
    digits: clampInt(r.digits, DIGIT_RANGE, d.digits),
    terms: clampInt(r.terms, TERM_RANGE, d.terms),
    ops: ops.length ? ops : d.ops,
    numberType: NUMBER_TYPES.some((t) => t.value === r.numberType) ? (r.numberType as NumberType) : d.numberType,
    allowNegative: typeof r.allowNegative === "boolean" ? r.allowNegative : d.allowNegative,
    durationSec: DURATIONS.includes(r.durationSec as number) ? (r.durationSec as number) : d.durationSec,
  };
}
