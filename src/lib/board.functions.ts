import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchLiveBoard } from "./api/providers.server";
import { runModel } from "./model/engine";
import { MODEL_VERSION } from "./model/metrics";
import type { BoardPayload } from "./types";

export const getBoard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        requestedMode: z.literal("LIVE").default("LIVE"),
        minConfidence: z.number().min(0).max(100).default(55),
        minEdgePct: z.number().min(-50).max(50).default(0),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<BoardPayload> => {
    const now = new Date();
    const nowIso = now.toISOString();
    const dateIso = nowIso.slice(0, 10);
    const result = await fetchLiveBoard(dateIso, nowIso);

    if (!result.connected || !result.data) {
      throw new Error(result.error ?? "Live MLB data is unavailable.");
    }

    const { picks, combos, bestBet } = runModel({
      games: result.data.games,
      players: result.data.players,
      statistics: result.data.statistics,
      teamStatistics: result.data.teamStatistics,
      markets: result.data.markets,
      nowIso,
      minConfidence: data.minConfidence,
      minEdgePct: data.minEdgePct,
    });

    const missingSources = result.data.sources.filter((source) => !source.connected).map((source) => source.name);
    const liveConnected = missingSources.length === 0;

    return {
      update: {
        mode: "LIVE",
        liveConnected,
        lastUpdatedAt: nowIso,
        sources: result.data.sources,
        modelVersion: MODEL_VERSION,
        message: liveConnected
          ? "Live MLB schedule, odds, injury and statistics data loaded."
          : `Live board is partial. Missing: ${missingSources.join(", ")}. No unavailable markets are fabricated.`,
      },
      games: result.data.games,
      players: result.data.players,
      statistics: result.data.statistics,
      teamStatistics: result.data.teamStatistics,
      markets: result.data.markets,
      picks,
      combos,
      bestBet,
    };
  });
