// Exact rational arithmetic on BigInt, so fractions, decimals and large powers
// are checked without floating-point error. Values are always kept reduced
// with a positive denominator.

export type Rational = { n: bigint; d: bigint };

function abs(x: bigint) {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function rat(n: bigint | number, d: bigint | number = 1n): Rational {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new RangeError("Division by zero");
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd) || 1n;
  return { n: nn / g, d: dd / g };
}

export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const pow = (a: Rational, e: number) => rat(a.n ** BigInt(e), a.d ** BigInt(e));
export const eq = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const isInteger = (a: Rational) => a.d === 1n;
export const isNegative = (a: Rational) => a.n < 0n;

/** Parses "12", "-3", "3/4", "-1 1/2" (mixed number) or "2.75". */
export function parseRational(input: string): Rational | null {
  const s = input.trim().replace(/\s+/g, " ").replace(/^−/, "-");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) {
    if (m[4] === "0" || /^0+$/.test(m[4])) return null;
    const whole = BigInt(m[2]);
    const frac = rat(BigInt(m[3]), BigInt(m[4]));
    const value = add(rat(whole), frac);
    return m[1] ? rat(-value.n, value.d) : value;
  }
  if ((m = s.match(/^(-?\d+)\/(-?\d+)$/))) {
    if (BigInt(m[2]) === 0n) return null;
    return rat(BigInt(m[1]), BigInt(m[2]));
  }
  if ((m = s.match(/^(-?)(\d*)\.(\d+)$/)) || (m = s.match(/^(-?)(\d+)\.()$/))) {
    const digits = m[3];
    const value = rat(BigInt((m[2] || "0") + digits), 10n ** BigInt(digits.length));
    return m[1] ? rat(-value.n, value.d) : value;
  }
  if (/^-?\d+$/.test(s)) return rat(BigInt(s));
  return null;
}

/** Decimal string if the value terminates, otherwise null. */
function toDecimal(a: Rational): string | null {
  let d = a.d;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return null;
  const places = Math.max(twos, fives);
  const scaled = abs(a.n) * 10n ** BigInt(places) / a.d;
  const digits = scaled.toString().padStart(places + 1, "0");
  const int = digits.slice(0, digits.length - places);
  const frac = digits.slice(digits.length - places);
  return `${a.n < 0n ? "-" : ""}${int}${places ? "." + frac : ""}`;
}

export function format(a: Rational, style: "fraction" | "decimal" = "fraction") {
  if (isInteger(a)) return a.n.toString();
  if (style === "decimal") {
    const dec = toDecimal(a);
    if (dec) return dec;
  }
  return `${a.n}/${a.d}`;
}
