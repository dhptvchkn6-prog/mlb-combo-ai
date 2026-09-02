import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { QualityBadge, RiskBadge } from "./app-chrome";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import { freshnessLabel, rankRationale } from "@/lib/model/metrics";
import { cn } from "@/lib/utils";
import type { Pick } from "@/lib/types";

function lineText(pick: Pick): string {
  if (pick.marketType === "MONEYLINE") return "Moneyline";
  if (pick.line === null) return "Line unavailable";
  if (pick.marketType === "RUNLINE") return pick.line > 0 ? `+${pick.line}` : String(pick.line);
  return `Over ${pick.line}`;
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "primary";
}) {
  return (
    <div className="rounded-lg bg-surface p-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-black tabular-nums",
          tone === "positive" && "text-safe",
          tone === "negative" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FreshnessDot({ pick }: { pick: Pick }) {
  const tone =
    pick.freshness === "FRESH"
      ? "bg-safe"
      : pick.freshness === "AGING"
        ? "bg-value"
        : pick.freshness === "STALE"
          ? "bg-warning"
          : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", tone)} />
      {freshnessLabel(pick.freshness)} · {pick.dataFreshnessMinutes}m
    </span>
  );
}

function MovementRow({ pick }: { pick: Pick }) {
  const movement = pick.movement;
  if (!movement || movement.direction === "UNAVAILABLE") {
    return (
      <p className="text-xs text-muted-foreground">Line movement unavailable from the connected feed.</p>
    );
  }
  const toward = movement.direction === "TOWARD";
  const Icon = toward ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        movement.direction === "UNCHANGED"
          ? "text-muted-foreground"
          : toward
            ? "text-safe"
            : "text-warning",
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {movement.direction === "UNCHANGED"
        ? "Price unchanged since open"
        : `${toward ? "Steaming toward" : "Drifting away from"} this side`}
      {" · "}
      {formatAmerican(movement.openingOdds)} → {formatAmerican(movement.currentOdds)}
    </p>
  );
}

export function PickCard({ pick, rank }: { pick: Pick; rank?: number }) {
  const [open, setOpen] = useState(false);
  const title = pick.selectionType === "PLAYER_PROP" ? pick.playerName : pick.teamName;
  if (!title || !pick.odds) return null;

  const edgePositive = (pick.edgePct ?? 0) >= 0;

  return (
    <article className="app-card overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 pb-3">
        <div className="min-w-0 space-y-1">
          {rank !== undefined ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Rank #{rank + 1} · Score {pick.rankScore.toFixed(1)}
            </p>
          ) : null}
          <h3 className="break-words text-lg font-black leading-tight">{title}</h3>
          <p className="break-words text-sm font-semibold text-muted-foreground">
            {pick.teamAbbreviation} vs {pick.opponentAbbreviation} · {pick.gameTime}
          </p>
          <p className="break-words text-sm font-bold">
            {pick.marketLabel} — {lineText(pick)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RiskBadge risk={pick.risk} />
          <p className="text-xl font-black tabular-nums text-primary">
            {formatAmerican(pick.odds.american)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {pick.bestSportsbook ?? "Live odds"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4">
        <Metric label="Model" value={formatPct(pick.probability)} tone="primary" />
        <Metric label="Implied" value={formatPct(pick.impliedProbability)} />
        <Metric
          label="Edge"
          value={pick.edgePct === null ? "—" : `${edgePositive ? "+" : ""}${pick.edgePct.toFixed(1)}pt`}
          tone={edgePositive ? "positive" : "negative"}
        />
        <Metric
          label="EV/$100"
          value={pick.evPer100 === null ? "—" : `${pick.evPer100 >= 0 ? "+" : ""}$${pick.evPer100.toFixed(2)}`}
          tone={(pick.evPer100 ?? 0) >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <QualityBadge quality={pick.dataQuality} />
        <FreshnessDot pick={pick} />
        {pick.quotes.length > 1 ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {pick.quotes.length} books
          </span>
        ) : null}
        {pick.lineupStatus !== "CONFIRMED" ? (
          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
            Lineup {pick.lineupStatus.toLowerCase()}
          </span>
        ) : null}
        {pick.playerStatus && pick.playerStatus !== "ACTIVE" ? (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
            {pick.playerStatus.toLowerCase()}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="tap-scale flex min-h-[48px] w-full items-center justify-between border-t border-border/70 px-4 text-sm font-bold uppercase tracking-wide"
      >
        Why this pick
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/70 bg-surface-2/40 px-4 py-3">
          <MovementRow pick={pick} />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ranking factors
            </p>
            <ul className="mt-1 space-y-1 text-xs">
              {rankRationale(pick).map((note) => (
                <li key={note} className="flex gap-2">
                  <span aria-hidden className="text-primary">
                    •
                  </span>
                  <span className="min-w-0 break-words">{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Break-even &amp; return
            </p>
            <dl className="mt-1 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-muted-foreground">Break-even</dt>
                <dd className="font-black tabular-nums">{formatPct(pick.breakEvenProbability)}</dd>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-muted-foreground">Expected ROI</dt>
                <dd className="font-black tabular-nums">{formatSignedPct(pick.expectedRoi)}</dd>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-muted-foreground">Decimal</dt>
                <dd className="font-black tabular-nums">
                  {pick.decimalOdds === null ? "—" : pick.decimalOdds.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>

          {pick.quotes.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Sportsbook prices
              </p>
              <ul className="mt-1 space-y-1">
                {pick.quotes.map((quote) => (
                  <li
                    key={`${quote.sportsbook}-${quote.american}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate font-semibold">{quote.sportsbook}</span>
                    <span
                      className={cn(
                        "shrink-0 font-black tabular-nums",
                        quote.sportsbook === pick.bestSportsbook && "text-primary",
                      )}
                    >
                      {formatAmerican(quote.american)}
                      {quote.line !== null ? ` (${quote.line > 0 ? "+" : ""}${quote.line})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Model inputs
            </p>
            <dl className="mt-1 rounded-lg bg-surface/70 px-3">
              {pick.reasoning.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0"
                >
                  <dt className="shrink-0 text-[11px] text-muted-foreground">{entry.label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 break-words text-right text-[11px] font-semibold",
                      !entry.available && "text-muted-foreground italic",
                    )}
                  >
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Model {pick.modelVersion}. Probabilities are calibrated estimates, not guarantees.
          </p>
        </div>
      ) : null}
    </article>
  );
}
