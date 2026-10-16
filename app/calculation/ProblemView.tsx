import { isInteger } from "./rational";
import { formatValue, type NumberType, type Problem } from "./problems";

const OP_SYMBOL = { "+": "+", "-": "−", "×": "×", "÷": "÷" } as const;

/** Typeset expression: stacked fractions and superscript exponents. */
export function ProblemView({
  problem,
  numberType,
  className = "",
}: {
  problem: Problem;
  numberType: NumberType;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-wrap items-center justify-center gap-x-[0.35em] gap-y-2 font-mono font-bold tabular-nums ${className}`}
    >
      {problem.factors.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-x-[0.35em]">
          {i > 0 && <span className="text-muted">{OP_SYMBOL[problem.ops[i - 1]]}</span>}
          <span className="inline-flex items-start">
            {numberType === "fraction" && !isInteger(f.value) ? (
              <>
                {f.exp && <span className="self-center font-normal text-muted">(</span>}
                <Fraction n={f.value.n.toString()} d={f.value.d.toString()} />
                {f.exp && <span className="self-center font-normal text-muted">)</span>}
              </>
            ) : (
              <span>{formatValue(f.value, numberType)}</span>
            )}
            {f.exp && <sup className="ml-0.5 text-[0.55em] leading-none">{f.exp}</sup>}
          </span>
        </span>
      ))}
    </span>
  );
}

function Fraction({ n, d }: { n: string; d: string }) {
  return (
    <span className="inline-flex flex-col items-center text-[0.7em] leading-tight">
      <span className="px-1">{n}</span>
      <span className="sr-only">over</span>
      <span className="w-full border-t-[0.08em] border-current" aria-hidden />
      <span className="px-1">{d}</span>
    </span>
  );
}
