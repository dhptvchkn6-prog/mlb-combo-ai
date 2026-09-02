import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef } from "react";

import { getBoard } from "./board.functions";
import { useSettings } from "./settings";
import type { BoardPayload } from "./types";

export function useBoard() {
  const { settings, hydrated } = useSettings();
  const fetchBoard = useServerFn(getBoard);
  const queryClient = useQueryClient();
  const refreshing = useRef(false);

  const queryKey = ["board", settings.dataMode, settings.minConfidence, settings.minEdgePct] as const;

  const query = useQuery<BoardPayload>({
    queryKey,
    queryFn: () =>
      fetchBoard({
        data: {
          requestedMode: settings.dataMode,
          minConfidence: settings.minConfidence,
          minEdgePct: settings.minEdgePct,
        },
      }),
    staleTime: 60_000,
    enabled: hydrated,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      // Prevent duplicate simultaneous refresh requests.
      if (refreshing.current) return null;
      refreshing.current = true;
      try {
        const data = await fetchBoard({
          data: { requestedMode: settings.dataMode, minConfidence: settings.minConfidence },
        });
        queryClient.setQueryData(queryKey, data);
        return data;
      } finally {
        refreshing.current = false;
      }
    },
  });

  const refresh = useCallback(() => {
    if (mutation.isPending) return;
    mutation.mutate();
  }, [mutation]);

  // Auto refresh interval
  useEffect(() => {
    if (settings.refreshInterval === "MANUAL") return;
    const ms = Number(settings.refreshInterval) * 60_000;
    const id = window.setInterval(() => {
      if (!refreshing.current) mutation.mutate();
    }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.refreshInterval, settings.dataMode, settings.minConfidence]);

  return {
    board: query.data ?? null,
    isLoading: query.isLoading || !hydrated,
    isError: query.isError,
    error: query.error as Error | null,
    retry: () => query.refetch(),
    refresh,
    isRefreshing: mutation.isPending,
  };
}
