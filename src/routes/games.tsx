import { createFileRoute, Link } from "@tanstack/react-router";

import { DataStatusBanner, LoadingCards, Screen, ScreenTitle, StatePanel } from "@/components/app-chrome";
import { useBoard } from "@/lib/use-board";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Today's Games — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Today's MLB game board with start times, status, starting pitchers and data freshness for each matchup.",
      },
      { property: "og:title", content: "Today's Games — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "MLB game board with pitchers, status and data freshness.",
      },
    ],
  }),
  component: GamesScreen,
});

function GamesScreen() {
  const { board, isLoading, isError, retry } = useBoard();

  return (
    <Screen>
      <ScreenTitle title="Games" subtitle="Today's board" />
      <DataStatusBanner update={board?.update ?? null} />

      {isLoading ? <LoadingCards /> : null}

      {isError ? (
        <StatePanel
          title="API error"
          message="The schedule request failed. Nothing is being shown rather than showing invented games."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}

      {!isLoading && !isError && (board?.games.length ?? 0) === 0 ? (
        <StatePanel
          title="No games available"
          message="No schedule data is available right now. Refresh from Home or try again later."
        />
      ) : null}

      <div className="space-y-3">
        {board?.games.map((game) => (
          <Link
            key={game.id}
            to="/game/$gameId"
            params={{ gameId: game.id }}
            aria-label={`${game.awayTeam.name} at ${game.homeTeam.name}, ${game.status}`}
            className="tap-scale app-card block p-4 active:border-primary/60"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black">{game.awayTeam.name}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  at
                </p>
                <p className="truncate text-base font-black">{game.homeTeam.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black tabular-nums">{game.startTime}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {game.status.replace("_", " ")}
                </p>
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Away SP</dt>
                <dd className="truncate font-semibold">{game.awayPitcher?.name ?? "Not announced"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Home SP</dt>
                <dd className="truncate font-semibold">{game.homePitcher?.name ?? "Not announced"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Lineups</dt>
                <dd className="font-semibold">{game.lineupStatus}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Data updated</dt>
                <dd className="font-semibold tabular-nums">
                  {new Date(game.dataUpdatedAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
