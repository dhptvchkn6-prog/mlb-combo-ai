// Pure betting math. No network, no UI, no randomness.
// Every value here is derived deterministically from inputs.

import { americanToDecimal, americanToImplied } from "../odds";
import type { DataFreshness, DataQuality, LineMovement, Pick } from "../types";

export const MODEL_VERSION = "mlb-v2.0";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Profit returned on a $100 stake if the bet wins. */
export function profitPer100(american: number): number {
  return american > 0 ? american : (100 / -american) * 100;
}

/**
 * Expected value of a $100 stake.
 * EV = p * profit_if_win - (1 - p) * stake, for both positive and negative prices.
 */
export function expectedValuePer100(probability: number, american: number): number {
  const p = clamp(probability, 0, 1);
  return p * profitPer100(american) - (1 - p) * 100;
}

/** Expected return per unit staked (EV per $100 divided by the $100 stake). */
export function expectedRoi(probability: number, american: number): number {
  return expectedValuePer100(probability, american) / 100;
}

/** Probability required for the bet to break even at this price. */
export function breakEvenProbability(american: number): number {
  return americanToImplied(american);
}

/** Realised profit in units for a settled bet at a 1-unit stake. */
export function profitUnits(american: number, result: "WIN" | "LOSS" | "PUSH" | "VOID"): number {
  if (result === "WIN") return profitPer100(american) / 100;
  if (result === "LOSS") return -1;
  return 0;
}

export const FRESHNESS_THRESHOLDS = { fresh: 5, aging: 15, stale: 30 } as const;

export function freshnessFor(minutes: number): DataFreshness {
  if (minutes < FRESHNESS_THRESHOLDS.fresh) return "FRESH";
  if (minutes < FRESHNESS_THRESHOLDS.aging) return "AGING";
  if (minutes < FRESHNESS_THRESHOLDS.stale) return "STALE";
  return "VERY_STALE";
}

export function freshnessLabel(freshness: DataFreshness): string {
  return {
    FRESH: "Fresh",
    AGING: "Aging",
    STALE: "Stale",
    VERY_STALE: "Very stale",
  }[freshness];
}

/**
 * Shrink a raw model probability toward the market price.
 * Prevents the model from routinely emitting unrealistic 85-90% numbers when
 * the sample behind the projection is thin or inputs are missing.
 *
 * shrinkage = base weight on the model, scaled by evidence strength (0..1).
 */
export function calibrateProbability(
  rawProbability: number,
  impliedProbability: number | null,
  evidence: number,
): number {
  const raw = clamp(rawProbability, 0.01, 0.99);
  if (impliedProbability === null || !Number.isFinite(impliedProbability)) {
    // No market anchor available: pull hard toward a coin flip.
    return clamp(0.5 + (raw - 0.5) * (0.35 + 0.35 * clamp(evidence, 0, 1)), 0.05, 0.85);
  }
  const modelWeight = 0.3 + 0.45 * clamp(evidence, 0, 1); // 0.30 .. 0.75
  const blended = raw * modelWeight + impliedProbability * (1 - modelWeight);
  return clamp(blended, 0.03, 0.9);
}

/** Documented weights for the deterministic ranking score. Sums to 100. */
export const RANK_WEIGHTS = {
  expectedValue: 30,
  edge: 22,
  confidence: 16,
  dataQuality: 12,
  freshness: 8,
  availability: 7,
  oddsQuality: 5,
} as const;

const QUALITY_SCORE: Record<DataQuality, number> = { HIGH: 1, MEDIUM: 0.55, LOW: 0.15 };
const FRESHNESS_SCORE: Record<DataFreshness, number> = {
  FRESH: 1,
  AGING: 0.75,
  STALE: 0.4,
  VERY_STALE: 0.1,
};

/**
 * Deterministic 0-100 ranking score.
 * Each input is normalised once and weighted once — no factor is double counted.
 */
export function rankScoreFor(input: {
  expectedRoi: number | null;
  edge: number | null;
  confidence: number;
  dataQuality: DataQuality;
  freshness: DataFreshness;
  availabilityScore: number; // 0..1 — lineup/pitcher/player certainty
  american: number | null;
  quoteCount: number;
}): number {
  const roiScore = clamp(((input.expectedRoi ?? -0.2) + 0.1) / 0.35, 0, 1); // -10% ROI -> 0, +25% -> 1
  const edgeScore = clamp(((input.edge ?? -0.05) + 0.02) / 0.12, 0, 1); // -2pt -> 0, +10pt -> 1
  const confidenceScore = clamp(input.confidence / 100, 0, 1);
  // Prices far outside the mainstream range are less reliable to model.
  const american = input.american ?? -110;
  const oddsScore = american >= -250 && american <= 400 ? 1 : american >= -600 ? 0.5 : 0.2;
  const liquidityBonus = clamp((input.quoteCount - 1) / 3, 0, 1);

  const total =
    RANK_WEIGHTS.expectedValue * roiScore +
    RANK_WEIGHTS.edge * edgeScore +
    RANK_WEIGHTS.confidence * confidenceScore +
    RANK_WEIGHTS.dataQuality * QUALITY_SCORE[input.dataQuality] +
    RANK_WEIGHTS.freshness * FRESHNESS_SCORE[input.freshness] +
    RANK_WEIGHTS.availability * clamp(input.availabilityScore, 0, 1) +
    RANK_WEIGHTS.oddsQuality * (oddsScore * 0.7 + liquidityBonus * 0.3);

  return Math.round(total * 10) / 10;
}

/** Explains, in plain language, why a pick ranked where it did. */
export function rankRationale(pick: Pick): string[] {
  const notes: string[] = [];
  if (pick.edgePct !== null) {
    notes.push(
      pick.edgePct >= 0
        ? `Model probability is ${pick.edgePct.toFixed(1)} points above the implied price.`
        : `Model probability is ${Math.abs(pick.edgePct).toFixed(1)} points below the implied price.`,
    );
  }
  if (pick.expectedRoi !== null) {
    notes.push(`Estimated return of ${(pick.expectedRoi * 100).toFixed(1)}% per unit staked.`);
  }
  notes.push(`Confidence ${pick.confidence}/100 with ${pick.dataQuality.toLowerCase()} data quality.`);
  notes.push(`Inputs are ${freshnessLabel(pick.freshness).toLowerCase()} (${pick.dataFreshnessMinutes} min old).`);
  if (pick.quotes.length > 1) {
    notes.push(`Best of ${pick.quotes.length} sportsbook prices (${pick.bestSportsbook ?? "unknown book"}).`);
  }
  if (pick.missingInputs.length > 0) {
    notes.push(`Unavailable inputs: ${pick.missingInputs.join(", ")}.`);
  }
  return notes;
}

export function decimalFor(american: number | null): number | null {
  return american === null ? null : americanToDecimal(american);
}

export function movementDirection(
  movement: Pick<LineMovement, "openingOdds" | "currentOdds">,
): LineMovement["direction"] {
  const { openingOdds, currentOdds } = movement;
  if (openingOdds === null || currentOdds === null) return "UNAVAILABLE";
  const openImplied = americanToImplied(openingOdds);
  const nowImplied = americanToImplied(currentOdds);
  const delta = nowImplied - openImplied;
  if (Math.abs(delta) < 0.005) return "UNCHANGED";
  return delta > 0 ? "TOWARD" : "AWAY";
}
