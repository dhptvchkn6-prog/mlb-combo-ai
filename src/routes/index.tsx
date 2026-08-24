import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ConfidenceMeter,
  DemoBanner,
  LoadingCards,
  RiskBadge,
  Screen,
  StatePanel,
} from "@/components/app-chrome";
import { ComboCard, LegRow } from "@/components/combo-card";
import { useBoard } from "@/lib/use-board";
import { useSettings } from "@/lib/settings";
import type { RiskCategory } from "@/lib/types";
import { formatAmerican } from "@/lib/odds";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pro Baseball Combos — MLB Analytics Board" },
      {
        name: "description",
        content:
          "Mobile-first MLB analytics: model probability, implied probability and estimated edge across ranked statistical combinations.",
      },
      { property: "og:title", content: "Pro Baseball Combos — MLB Analytics Board" },
      {
        property: "og:description",
        content:
          "Ranked MLB statistical combinations by model probability and estimated value. Demo mode until live data is connected.",
      },
    ],
  }),
  component: HomeScreen,
});

const CATEGORIES: { risk: RiskCategory; icon: string; blurb: string }[] = [
  { risk: "SAFE", icon: "🛡️", blurb: "Highest model probability" },
  { risk: "SMART", icon: "🔥", blurb: "Best probability / price balance" },
  { risk: "VALUE", icon: "💰", blurb: "Largest model vs implied gap" },
  { risk: "AGGRESSIVE", icon: "🚀", blurb: "Higher risk, higher payout" },
];

function HomeScreen() {
  const { board, isLoading, isError, retry, refresh, isRefreshing } = useBoard();
  const { timezone } = useSettings();
  const [category, setCategory] = useState<RiskCategory>("SAFE");

  const todayLabel = useMemo(() => {
    const d = board ? new Date(board.update.lastUpdatedAt) : new Date();
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [board]);

  const updatedLabel = board
    ? new Date(board.update.lastUpdatedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "---";

  const filtered = (board?.combos ?? []).filter((c) => c.risk === category);
  const best = board?.combos?.[0] ?? null;

  return (
    <Screen>
      <header className="pt-1">
        <h1 className="text-2xl font-black uppercase leading-none tracking-tight">
          Pro Baseball Combos
        </h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-primary">
          MLB Analytics
        </p>
      </header>

      <DemoBanner update={board?.update ?? null} />

      <section className="app-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Today's Board
            </p>
            <p className="truncate text-sm font-semibold">{todayLabel}</p>
            <p className="mt-1 text-sm font-black">
              {board ? `${board.games.length} Games` : "— Games"}
            </p>
            <p className="text-xs text-muted-foreground">
              Data status:{" "}
              <span className="font-bold text-warning">
                {board?.update.liveConnected ? "LIVE" : "DEMO (live not connected)"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Last update: {updatedLabel} · {timezone}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh board data"
            className="tap-scale inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-black uppercase text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "…" : "Refresh"}
          </button>
        </div>
      </section>

      {isError ? (
        <StatePanel
          title="API error"
          message="We couldn't load the board. No data is being shown rather than showing anything invented."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}

      <div className="-mx-4 overflow-x-auto no-scrollbar px-4">
        <div className="flex w-max gap-2 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.risk}
              type="button"
              onClick={() => setCategory(c.risk)}
              aria-pressed={category === c.risk}
              className={`tap-scale min-h-[48px] rounded-full border px-4 text-sm font-bold uppercase tracking-wide ${
                category === c.risk
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground"
              }`}
            >
              <span aria-hidden className="mr-1">
                {c.icon}
              </span>
              {c.risk}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {CATEGORIES.find((c) => c.risk === category)?.blurb}
      </p>

      {isLoading ? <LoadingCards /> : null}

      {!isLoading && best ? (
        <section className="app-card border-primary/40 p-4 shadow-glow">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">
                Best Combo
              </p>
              <p className="truncate text-lg font-black">{best.name}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {best.legs.length} LEGS · {formatAmerican(best.combinedOdds)}
              </p>
            </div>
            <RiskBadge risk={best.risk} />
          </div>
          <div className="mt-3">
            <ConfidenceMeter value={best.confidence} />
          </div>
          <div className="mt-3 space-y-2">
            {best.legs.map((leg, i) => (
              <LegRow key={leg.id} leg={leg} index={i} />
            ))}
          </div>
          <Link
            to="/combo/$comboId"
            params={{ comboId: best.id }}
            className="tap-scale mt-3 flex min-h-[48px] items-center justify-center rounded-full bg-primary text-sm font-black uppercase tracking-wide text-primary-foreground"
          >
            View details
          </Link>
        </section>
      ) : null}

      {!isLoading && !isError ? (
        filtered.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              {category} combos
            </h2>
            {filtered.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </section>
        ) : (
          <StatePanel
            title="Not enough qualifying data to build this combo."
            message="No picks currently clear the confidence and data-quality thresholds for this category. Lower the minimum confidence in Settings or refresh later."
          />
        )
      ) : null}

      <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Model confidence scores are estimates, not guarantees. No pick is a lock.
      </p>
    </Screen>
  );
}
