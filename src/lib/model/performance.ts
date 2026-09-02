// Pure performance analytics over settled predictions.

import { profitUnits } from "./metrics";
import type { PerformanceBucket, PerformanceSummary, TrackedPrediction } from "../types";

function emptyBucket(label: string): PerformanceBucket {
  return {
    label,
    wins: 0,
    losses: 0,
    pushes: 0,
    pending: 0,
    winRate: null,
    units: 0,
    roi: null,
    averageEdge: null,
    averageConfidence: null,
  };
}

function buildBucket(label: string, rows: TrackedPrediction[]): PerformanceBucket {
  const bucket = emptyBucket(label);
  let staked = 0;
  let edgeTotal = 0;
  let confidenceTotal = 0;

  for (const row of rows) {
    edgeTotal += row.edge;
    confidenceTotal += row.confidence;
    if (row.result === "PENDING") {
      bucket.pending += 1;
      continue;
    }
    if (row.result === "VOID") continue;
    if (row.result === "WIN") bucket.wins += 1;
    else if (row.result === "LOSS") bucket.losses += 1;
    else bucket.pushes += 1;

    staked += 1;
    bucket.units += row.profitUnits ?? profitUnits(row.american, row.result);
  }

  const decided = bucket.wins + bucket.losses;
  bucket.winRate = decided > 0 ? bucket.wins / decided : null;
  bucket.units = Math.round(bucket.units * 100) / 100;
  bucket.roi = staked > 0 ? bucket.units / staked : null;
  bucket.averageEdge = rows.length > 0 ? edgeTotal / rows.length : null;
  bucket.averageConfidence = rows.length > 0 ? confidenceTotal / rows.length : null;
  return bucket;
}

function groupBy(rows: TrackedPrediction[], key: (row: TrackedPrediction) => string): PerformanceBucket[] {
  const groups = new Map<string, TrackedPrediction[]>();
  for (const row of rows) {
    const label = key(row);
    const list = groups.get(label);
    if (list) list.push(row);
    else groups.set(label, [row]);
  }
  return Array.from(groups.entries())
    .map(([label, group]) => buildBucket(label, group))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}

const CONFIDENCE_BANDS = [
  { label: "50-59", min: 0, max: 60 },
  { label: "60-69", min: 60, max: 70 },
  { label: "70-79", min: 70, max: 80 },
  { label: "80+", min: 80, max: 101 },
];

const CALIBRATION_BANDS = [
  { label: "40-50%", min: 0.4, max: 0.5 },
  { label: "50-55%", min: 0.5, max: 0.55 },
  { label: "55-60%", min: 0.55, max: 0.6 },
  { label: "60-70%", min: 0.6, max: 0.7 },
  { label: "70%+", min: 0.7, max: 1.01 },
];

export function summarisePerformance(rows: TrackedPrediction[]): PerformanceSummary {
  const settled = rows.filter((row) => row.result !== "PENDING" && row.result !== "VOID");

  const calibration = CALIBRATION_BANDS.map((band) => {
    const inBand = settled.filter(
      (row) => row.modelProbability >= band.min && row.modelProbability < band.max,
    );
    const decided = inBand.filter((row) => row.result === "WIN" || row.result === "LOSS");
    return {
      bucket: band.label,
      predicted:
        inBand.length > 0 ? inBand.reduce((acc, row) => acc + row.modelProbability, 0) / inBand.length : null,
      actual:
        decided.length > 0 ? decided.filter((row) => row.result === "WIN").length / decided.length : null,
      samples: inBand.length,
    };
  });

  const decidedAll = settled.filter((row) => row.result === "WIN" || row.result === "LOSS");
  const brierScore =
    decidedAll.length > 0
      ? decidedAll.reduce((acc, row) => {
          const outcome = row.result === "WIN" ? 1 : 0;
          return acc + Math.pow(row.modelProbability - outcome, 2);
        }, 0) / decidedAll.length
      : null;

  return {
    overall: buildBucket("All predictions", rows),
    byMarket: groupBy(rows, (row) => row.marketLabel),
    byConfidence: CONFIDENCE_BANDS.map((band) =>
      buildBucket(
        band.label,
        rows.filter((row) => row.confidence >= band.min && row.confidence < band.max),
      ),
    ).filter((bucket) => bucket.wins + bucket.losses + bucket.pending > 0),
    byRisk: groupBy(rows, (row) => row.risk),
    byModelVersion: groupBy(rows, (row) => row.modelVersion),
    calibration,
    brierScore,
    gradedCount: decidedAll.length,
  };
}
