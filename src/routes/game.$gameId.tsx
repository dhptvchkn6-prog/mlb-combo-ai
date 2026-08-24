import { createFileRoute, useParams } from "@tanstack/react-router";

import {
  BackButton,
  DemoBanner,
  LoadingCards,
  QualityBadge,
  Screen,
  StatePanel,
} from "@/components/app-chrome";
import { formatAmerican, formatPct } from "@/lib/odds";
import { useBoard } from "@/lib/use-board";

export const Route = createFileRoute("/game/$gameId")({
  head: () => ({
    meta: [
      { title: "Game Details — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Matchup detail: starting pitchers, available markets, player props, lineup status and weather when available.",
      },
      { property: "og:title", content: "Game Details — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Pitchers, markets, props and lineup status for a single matchup.",
      },
    ],
  }),
  component: GameDetails,
});

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-right text-xs font-semibold ${value ? "" : "text-muted-foreground"}`}>
        {value ?? "Not available"}
      </dd>
    </div>
  );
}

function GameDetails() {
  const { gameId } = useParams({ from: "/game/$gameId" });
  const { board, isLoading, isError, retry } = useBoard();

  const game = board?.games.find((g) => g.id === gameId) ?? null;
  const picks = (board?.picks ?? []).filter((p) => p.gameId === gameId);
  const markets = (board?.markets ?? []).filter((m) => m.gameId === gameId);

  return (
    <Screen>
      <BackButton />
      <DemoBanner update={board?.update ?? null} />

      {isLoading ? <LoadingCards /> : null}
      {isError ? (
        <StatePanel
          title="API error"
          message="Could not load this matchup."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}

      {!isLoading && !isError && !game ? (
        <StatePanel title="Game not found" message="This matchup is no longer on the board." />
      ) : null}

      {game ? (
        <>
          <section className="app-card p-4">
            <h1 className="text-xl font-black leading-tight">
              {game.awayTeam.name}
              <span className="mx-2 text-muted-foreground">@</span>
              {game.homeTeam.name}
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">
              {game.startTime} · {game.status.replace("_", " ")}
            </p>
            <dl className="mt-3">
              <Row label="Venue" value={game.venue} />
              <Row label="Lineups" value={game.lineupStatus === "UNAVAILABLE" ? null : game.lineupStatus} />
              <Row
                label="Weather"
                value={
                  game.weather
                    ? `${game.weather.temperatureF}°F, ${game.weather.conditions}, wind ${game.weather.windMph} mph ${game.weather.windDirection}`
                    : null
                }
              />
              <Row
                label="Data updated"
                value={new Date(game.dataUpdatedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </dl>
          </section>

          <section className="app-card p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Starting pitchers
            </h2>
            <dl className="mt-2">
              <Row
                label={`${game.awayTeam.abbreviation} SP`}
                value={
                  game.awayPitcher
                    ? `${game.awayPitcher.name} (${game.awayPitcher.throws}HP, ${game.awayPitcher.era ?? "—"} ERA, ${game.awayPitcher.strikeoutsPer9 ?? "—"} K/9)`
                    : null
                }
              />
              <Row
                label={`${game.homeTeam.abbreviation} SP`}
                value={
                  game.homePitcher
                    ? `${game.homePitcher.name} (${game.homePitcher.throws}HP, ${game.homePitcher.era ?? "—"} ERA, ${game.homePitcher.strikeoutsPer9 ?? "—"} K/9)`
                    : null
                }
              />
            </dl>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Available markets & props
            </h2>
            {markets.length === 0 ? (
              <StatePanel
                title="No markets available"
                message="No market data is available for this matchup."
              />
            ) : (
              markets.map((market) => {
                const pick = picks.find((p) => p.marketId === market.id) ?? null;
                return (
                  <div key={market.id} className="app-card p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {board?.players.find((p) => p.id === market.playerId)?.name ??
                            "Unknown selection"}
                        </p>
                        <p className="text-xs text-muted-foreground">{market.label}</p>
                      </div>
                      <span className="shrink-0 text-sm font-black tabular-nums">
                        {formatAmerican(market.odds?.american)}
                      </span>
                    </div>
                    {pick ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-surface-2 px-2 py-1 font-bold tabular-nums text-primary">
                          Model {formatPct(pick.probability)}
                        </span>
                        <span className="rounded-full bg-surface-2 px-2 py-1 font-bold tabular-nums">
                          Implied {formatPct(pick.impliedProbability)}
                        </span>
                        <QualityBadge quality={pick.dataQuality} />
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        No model projection available for this market.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </>
      ) : null}
    </Screen>
  );
}
