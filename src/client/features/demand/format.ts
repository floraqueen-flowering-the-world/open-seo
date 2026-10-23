// Spanish number format (FloraQueen): "." for thousands, "," for decimals, and
// 4-digit numbers grouped too (5.400). es-ES skips grouping below 10.000 and
// TypeScript's lib does not type useGrouping: "always" yet; de-DE writes
// exactly the format we want.
const LOCALE = "de-DE";
const intFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatInt(value: number) {
  return intFormat.format(Math.round(value));
}

export function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** 0,0078 -> "0,78%" */
export function formatRate(ratio: number, digits = 2) {
  return `${formatDecimal(ratio * 100, digits)}%`;
}

/** Growth ratio -0,041 -> "−4,1%"; null (no previous data) -> "new". */
export function formatChange(ratio: number | null, digits = 0) {
  if (ratio === null) return "new";
  const pct = ratio * 100;
  const text = formatDecimal(Math.abs(pct), digits);
  if (text === formatDecimal(0, digits)) return `${text}%`;
  return `${pct > 0 ? "+" : "−"}${text}%`;
}

/** 764.212 -> "764k", 4.381.000 -> "4,38M" */
export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${formatDecimal(value / 1_000_000, 2)}M`;
  if (value >= 10_000) return `${formatInt(value / 1000)}k`;
  return formatInt(value);
}

export function growth(current: number, previous: number) {
  return previous > 0 ? current / previous - 1 : null;
}
