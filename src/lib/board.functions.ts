import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildDemoDataset } from "./demo-data";
import { runModel } from "./model/engine";
import { fetchLiveBoard, getProviderStatus, isLiveConnected } from "./api/providers.server";
import type { BoardPayload } from "./types";

const inputSchema = z.object({
  requestedMode: z.enum(["LIVE", "DEMO"]).default("DEMO"),
  minConfidence: z.number().min(0).max(100).default(55),
});

export const getBoard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<BoardPayload> => {
    const nowIso = new Date().toISOString();
    const sources = getProviderStatus();
    const live = isLiveConnected();

    if (data.requestedMode === "LIVE") {
      const result = await fetchLiveBoard();
      if (!result.connected || !result.data) {
        // Never silently fall back to fake "live" data.
        return {
          update: {
            mode: "DEMO",
            liveConnected: live,
            lastUpdatedAt: nowIso,
            sources,
            message: "Live data isn't connected yet. Showing demo data, clearly labeled.",
          },
          games: [],
          players: [],
          statistics: [],
          markets: [],
          picks: [],
          combos: [],
        };
      }
    }

    const demo = buildDemoDataset(nowIso);
    const { picks, combos } = runModel({
      games: demo.games,
      players: demo.players,
      statistics: demo.statistics,
      markets: demo.markets,
      nowIso,
      minConfidence: data.minConfidence,
    });

    return {
      update: {
        mode: "DEMO",
        liveConnected: live,
        lastUpdatedAt: nowIso,
        sources,
        message: "Demo dataset. All names, odds and statistics are fictional samples.",
      },
      games: demo.games,
      players: demo.players,
      statistics: demo.statistics,
      markets: demo.markets,
      picks,
      combos,
    };
  });
