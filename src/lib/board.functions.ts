import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchLiveBoard } from "./api/providers.server";
import { runModel } from "./model/engine";
import type { BoardPayload } from "./types";

export const getBoard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        requestedMode: z.literal("LIVE").default("LIVE"),
        minConfidence: z.number().min(0).max(100).default(55),
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

    const { picks, combos } = runModel({
      games: result.data.games,
      players: result.data.players,
      statistics: result.data.statistics,
      teamStatistics: result.data.teamStatistics,
      markets: result.data.markets,
      nowIso,
      minConfidence: data.minConfidence,
    });

    return {
      update: {
        mode: "LIVE",
        liveConnected: true,
        lastUpdatedAt: nowIso,
        sources: result.data.sources,
        message: "Live MLB schedule, odds, injury and statistics data loaded.",
      },
      games: result.data.games,
      players: result.data.players,
      statistics: result.data.statistics,
      teamStatistics: result.data.teamStatistics,
      markets: result.data.markets,
      picks,
      combos,
    };
  });
