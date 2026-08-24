export function americanToImplied(american: number): number {
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

export function americanToDecimal(american: number): number {
  return american > 0 ? american / 100 + 1 : 100 / -american + 1;
}

export function decimalToAmerican(decimal: number): number {
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export function formatAmerican(american: number | null | undefined): string {
  if (american === null || american === undefined) return "—";
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}
