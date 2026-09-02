import { createServerFn } from "@tanstack/react-start";

import { fetchLiveBoard } from "./api/providers.server";
import { runModel } from "./model/engine";
import { profitUnits } from "./model/metrics";
import { summarisePerformance } from "./model/performance";
import type { GradeResult, PerformanceSummary, TrackedPrediction } from "./types";

interface PredictionRow {
  prediction_id: string;
  market_id: string;
  game_id: string;
  game_date: string;
  selection_type: string;
  player_id: string | null;
  subject: string;
  opponent: string;
  market_type: string;
  market_label: string;
  line: number | null;
  american: number;
  sportsbook: string;
  model_probability: number;
  implied_probability: number;
  edge: number;
  ev_per_100: number;
  confidence: number;
  risk: string;
  data_quality: string;
  model_version: string;
  created_at: string;
  result: string;
  actual_value: number | null;
  graded_at: string | null;
  profit_units: number | null;
}

function toTracked(row: PredictionRow): TrackedPrediction {
  return {
    id: row.prediction_id,
    predictionId: row.prediction_id,
    marketId: row.market_id,
    gameId: row.game_id,
    gameDate: row.game_date,
    selectionType: row.selection_type === "PLAYER_PROP" ? "PLAYER_PROP" : "TEAM_BET",
    playerId: row.player_id,
    subject: row.subject,
    opponent: row.opponent,
    marketType: row.market_type as TrackedPrediction["marketType"],
    marketLabel: row.market_label,
    line: row.line === null ? null : Number(row.line),
    american: Number(row.american),
    sportsbook: row.sportsbook,
    modelProbability: Number(row.model_probability),
    impliedProbability: Number(row.implied_probability),
    edge: Number(row.edge),
    evPer100: Number(row.ev_per_100),
    confidence: Number(row.confidence),
    risk: row.risk as TrackedPrediction["risk"],
    dataQuality: row.data_quality as TrackedPrediction["dataQuality"],
    modelVersion: row.model_version,
    createdAt: row.created_at,
    result: row.result as GradeResult,
    actualValue: row.actual_value === null ? null : Number(row.actual_value),
    gradedAt: row.graded_at,
    profitUnits: row.profit_units === null ? null : Number(row.profit_units),
  };
}

/**
 * Recomputes today's board server-side and stores every qualifying pick plus a
 * price snapshot. Takes no caller input, so it cannot be used to inject rows.
 */
export const snapshotPredictions = createServerFn({ method: "POST" }).handler(async () => {
  const nowIso = new Date().toISOString();
  const dateIso = nowIso.slice(0, 10);
  const board = await fetchLiveBoard(dateIso, nowIso);
  if (!board.connected || !board.data) return { recorded: 0, snapshots: 0 };

  const { picks } = runModel({
    games: board.data.games,
    players: board.data.players,
    statistics: board.data.statistics,
    teamStatistics: board.data.teamStatistics,
    markets: board.data.markets,
    nowIso,
  });

  const tracked = picks.filter((pick) => pick.odds && (pick.edgePct ?? -1) > 0 && pick.dataQuality !== "LOW");
  if (tracked.length === 0) return { recorded: 0, snapshots: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const rows = tracked.map((pick) => ({
    prediction_id: `${dateIso}:${pick.marketId}`,
    market_id: pick.marketId,
    game_id: pick.gameId,
    game_date: dateIso,
    selection_type: pick.selectionType,
    player_id: pick.playerId,
    subject: pick.playerName ?? pick.teamName,
    opponent: pick.opponentName,
    market_type: pick.marketType,
    market_label: pick.marketLabel,
    line: pick.line,
    american: pick.odds?.american ?? 0,
    sportsbook: pick.odds?.sportsbook ?? "Live odds",
    model_probability: pick.probability,
    implied_probability: pick.impliedProbability ?? 0,
    edge: pick.edge ?? 0,
    ev_per_100: pick.evPer100 ?? 0,
    confidence: pick.confidence,
    risk: pick.risk,
    data_quality: pick.dataQuality,
    model_version: pick.modelVersion,
  }));

  await supabaseAdmin.from("predictions").upsert(rows, { onConflict: "prediction_id", ignoreDuplicates: true });

  const snapshots = tracked.flatMap((pick) =>
    pick.quotes.map((quote) => ({
      market_id: pick.marketId,
      game_id: pick.gameId,
      sportsbook: quote.sportsbook,
      line: quote.line,
      american: quote.american,
    })),
  );
  if (snapshots.length > 0) await supabaseAdmin.from("line_snapshots").insert(snapshots);

  return { recorded: rows.length, snapshots: snapshots.length };
});

/** Settles pending predictions against final MLB scores. */
export const gradePredictions = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchFinalScores, gradeTeamBet } = await import("./tracking.server");

  const { data } = await supabaseAdmin
    .from("predictions")
    .select("*")
    .eq("result", "PENDING")
    .order("game_date", { ascending: false })
    .limit(500);

  const pending = (data ?? []) as unknown as PredictionRow[];
  if (pending.length === 0) return { graded: 0 };

  const dates = Array.from(new Set(pending.map((row) => row.game_date)));
  const scoresByDate = new Map<string, Awaited<ReturnType<typeof fetchFinalScores>>>();
  for (const date of dates) scoresByDate.set(date, await fetchFinalScores(date));

  let graded = 0;
  for (const row of pending) {
    const score = scoresByDate.get(row.game_date)?.get(row.game_id);
    if (!score || !score.isFinal) continue;
    if (row.selection_type !== "TEAM_BET") continue;

    // The stored subject is the team name; resolve the side by matching the game id map.
    const isHome = row.market_id.includes(`-${score.homeTeamId}-`);
    const teamScore = isHome ? score.homeScore : score.awayScore;
    const opponentScore = isHome ? score.awayScore : score.homeScore;
    const { result, actualValue } = gradeTeamBet({
      marketType: row.market_type,
      line: row.line === null ? null : Number(row.line),
      teamScore,
      opponentScore,
    });

    await supabaseAdmin
      .from("predictions")
      .update({
        result,
        actual_value: actualValue,
        graded_at: new Date().toISOString(),
        profit_units: profitUnits(Number(row.american), result),
      })
      .eq("prediction_id", row.prediction_id);
    graded += 1;
  }

  return { graded };
});

/** Public read of tracked performance: win rate, ROI, calibration. */
export const getPerformance = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ summary: PerformanceSummary; recent: TrackedPrediction[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("predictions")
      .select("*")
      .order("game_date", { ascending: false })
      .limit(1000);

    const rows = ((data ?? []) as unknown as PredictionRow[]).map(toTracked);
    return { summary: summarisePerformance(rows), recent: rows.slice(0, 50) };
  },
);
