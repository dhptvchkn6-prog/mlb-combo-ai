// Runtime schemas for external API payloads. Every value the provider reads is
// validated here so parsed stat totals are always `number | null`, never unknown.

import { z } from "zod";

/** A numeric stat that may arrive as a number, a formatted string, or a blank sentinel. */
export const statNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/[+,%]/g, "").trim();
    if (!cleaned || cleaned === ".---" || cleaned === "-" || cleaned === "--") return null;
    const parsed = Number(cleaned.startsWith(".") ? `0${cleaned}` : cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  });

/** American odds: an integer or null. */
export const americanOdds = statNumber.transform((value) => (value === null ? null : Math.round(value)));

export const optionalString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value): string | null => (typeof value === "string" ? value : null));

/** Unknown-shaped object that still guarantees safe key access. */
export const jsonRecord = z.record(z.unknown());

/** Anything: passthrough for nested payloads validated lazily further down. */
export const unknownArray = z
  .union([z.array(z.unknown()), z.null(), z.undefined(), z.unknown()])
  .transform((value): unknown[] => (Array.isArray(value) ? value : []));

/**
 * Parse `value` with `schema`, returning `fallback` when the payload does not
 * match. External APIs change without notice, so validation never throws.
 */
export function safeParse<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  fallback: z.output<S>,
): z.output<S> {
  const result = schema.safeParse(value);
  return result.success ? (result.data as z.output<S>) : fallback;
}

/** Reads a stat field off an unvalidated container as a strict `number | null`. */
export function readStat(container: unknown, key: string): number | null {
  if (typeof container !== "object" || container === null || Array.isArray(container)) return null;
  return safeParse(statNumber, (container as Record<string, unknown>)[key], null);
}

/** Reads a stat field as strict American odds. */
export function readAmerican(container: unknown, key: string): number | null {
  if (typeof container !== "object" || container === null || Array.isArray(container)) return null;
  return safeParse(americanOdds, (container as Record<string, unknown>)[key], null);
}

// ---------------------------------------------------------------------------
// Response envelopes. Each keeps unknown internals but guarantees the container
// shape the provider iterates over.
// ---------------------------------------------------------------------------

export const scheduleResponse = z.object({
  dates: unknownArray,
});

export const peopleResponse = z.object({
  people: unknownArray,
});

export const rosterResponse = z.object({
  roster: unknownArray,
});

export const teamStatsResponse = z.object({
  stats: unknownArray,
});

export const transactionsResponse = z.object({
  transactions: unknownArray,
});

export const espnListResponse = z.object({
  items: unknownArray,
});

export const liveFeedResponse = z.object({
  gameData: z
    .object({
      weather: jsonRecord.optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
});

export type ScheduleResponse = z.infer<typeof scheduleResponse>;
