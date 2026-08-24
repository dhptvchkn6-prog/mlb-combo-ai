import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { DemoBanner, LoadingCards, Screen, ScreenTitle, StatePanel } from "@/components/app-chrome";
import { useBoard } from "@/lib/use-board";
import type { PlayerStatistics, Player, SplitLine } from "@/lib/types";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Expandable player and team analytics cards: season, last 5, last 10, home/away, platoon splits and opponent matchup.",
      },
      { property: "og:title", content: "Stats — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Season, recent form, home/away and platoon split analytics cards.",
      },
    ],
  }),
  component: StatsScreen,
});

function SplitRow({ label, split }: { label: string; split: SplitLine | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs font-bold tabular-nums">
        {split ? `${split.average} (${split.games} G)` : "Not available"}
      </dd>
    </div>
  );
}

function StatCard({
  player,
  stats,
  teamName,
}: {
  player: Player;
  stats: PlayerStatistics;
  teamName: string;
}) {
  const [open, setOpen] = useState(false);
  const trendUp = stats.last5.average >= stats.season.average;

  return (
    <article className="app-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap-scale grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-base font-black">{player.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {teamName} · {player.position} · Bats {player.bats}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider">
            <span className={trendUp ? "text-primary" : "text-warning"}>
              {trendUp ? "▲ Trending up" : "▼ Trending down"}
            </span>
            <span className="ml-2 text-muted-foreground">Season {stats.season.average}</span>
          </p>
        </div>
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <dl className="border-t border-border px-4 pb-4">
          <SplitRow label="Season" split={stats.season} />
          <SplitRow label="Last 5" split={stats.last5} />
          <SplitRow label="Last 10" split={stats.last10} />
          <SplitRow label="Home" split={stats.home} />
          <SplitRow label="Away" split={stats.away} />
          <SplitRow label="vs LHP" split={stats.vsLeft} />
          <SplitRow label="vs RHP" split={stats.vsRight} />
          <SplitRow label="Opponent matchup" split={stats.opponent} />
          <div className="flex items-center justify-between gap-3 pt-2">
            <dt className="text-xs text-muted-foreground">Sample size</dt>
            <dd className="text-xs font-bold tabular-nums">{stats.sampleSize} PA</dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

function StatsScreen() {
  const { board, isLoading, isError, retry } = useBoard();

  const teamName = (teamId: string) =>
    board?.games
      .flatMap((g) => [g.homeTeam, g.awayTeam])
      .find((t) => t.id === teamId)?.name ?? "Unknown team";

  const cards = (board?.statistics ?? [])
    .map((s) => {
      const player = board?.players.find((p) => p.id === s.playerId);
      return player ? { player, stats: s } : null;
    })
    .filter((v): v is { player: Player; stats: PlayerStatistics } => v !== null);

  return (
    <Screen>
      <ScreenTitle title="Stats" subtitle="Tap a card to expand splits" />
      <DemoBanner update={board?.update ?? null} />

      {isLoading ? <LoadingCards count={4} /> : null}
      {isError ? (
        <StatePanel
          title="API error"
          message="Statistics could not be loaded."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}
      {!isLoading && !isError && cards.length === 0 ? (
        <StatePanel
          title="No statistics available"
          message="No statistical data is connected right now."
        />
      ) : null}

      <div className="space-y-3">
        {cards.map(({ player, stats }) => (
          <StatCard
            key={player.id}
            player={player}
            stats={stats}
            teamName={teamName(player.teamId)}
          />
        ))}
      </div>
    </Screen>
  );
}
