import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { QualityBadge } from "./app-chrome";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import type { Pick } from "@/lib/types";

function lineText(leg: Pick): string {
  if (leg.marketType === "MONEYLINE") return "";
  if (leg.line === null) return "Line unavailable";
  if (leg.marketType === "RUNLINE") return leg.line > 0 ? `+${leg.line}` : String(leg.line);
  return `Over ${leg.line}`;
}

function marketLine(leg: Pick): string {
  const line = lineText(leg);
  return line ? `${leg.marketLabel} — ${line}` : leg.marketLabel;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-semibold break-words">{value}</dd>
    </div>
  );
}

export function PickLeg({ leg, index, defaultOpen = false }: { leg: Pick; index?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const title = leg.selectionType === "PLAYER_PROP" ? leg.playerName : leg.teamName;
  const matchup = `${leg.teamAbbreviation} vs ${leg.opponentAbbreviation}`;

  if (!title || !leg.teamName || !leg.opponentName || !leg.marketLabel || !leg.odds) return null;

  return (
    <article className="rounded-lg border border-border/70 bg-surface-2/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="tap-scale grid min-h-[112px] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-left"
      >
        <div className="min-w-0 space-y-1">
          {index !== undefined ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Leg {index + 1}
            </p>
          ) : null}
          <p className="break-words text-base font-black leading-tight">
            <span aria-hidden>{leg.selectionType === "PLAYER_PROP" ? "⚾ " : ""}</span>
            {title}
          </p>
          <p className="break-words text-sm font-bold text-muted-foreground">
            {leg.selectionType === "PLAYER_PROP"
              ? matchup
              : `vs ${leg.opponentName} (${leg.opponentAbbreviation})`}
          </p>
          <p className="break-words text-sm font-semibold">{marketLine(leg)}</p>
          <p className="text-lg font-black tabular-nums text-primary">
            {formatAmerican(leg.odds.american)}
          </p>
        </div>
        <ChevronDown
          aria-hidden
          className={`mt-1 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="grid grid-cols-4 gap-2 px-3 pb-3 text-center text-[11px]">
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-black tabular-nums text-primary">{formatPct(leg.probability)}</dd>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-muted-foreground">Implied</dt>
          <dd className="font-black tabular-nums">{formatPct(leg.impliedProbability)}</dd>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-muted-foreground">Edge</dt>
          <dd className="font-black tabular-nums">{formatSignedPct(leg.edge)}</dd>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/70 px-3 pb-3 pt-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <QualityBadge quality={leg.dataQuality} />
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {leg.projectionLabel}
            </span>
          </div>
          <dl className="rounded-lg bg-surface/70 px-3">
            <DetailRow label={leg.selectionType === "PLAYER_PROP" ? "Player" : "Team"} value={title} />
            <DetailRow label="Team" value={`${leg.teamName} (${leg.teamAbbreviation})`} />
            <DetailRow label="Opponent" value={`${leg.opponentName} (${leg.opponentAbbreviation})`} />
            <DetailRow label="Game time" value={leg.gameTime} />
            <DetailRow label="Starting pitcher" value={leg.startingPitcher ?? "Not announced"} />
            <DetailRow label="Opposing pitcher" value={leg.opposingPitcher ?? "Not announced"} />
            <DetailRow label="Market" value={leg.marketLabel} />
            <DetailRow label="Line" value={lineText(leg) || "Moneyline"} />
            <DetailRow label="Odds" value={`${leg.odds.sportsbook} ${formatAmerican(leg.odds.american)}`} />
            <DetailRow label="Season stats" value={leg.seasonStats} />
            <DetailRow label="Last 5" value={leg.last5} />
            <DetailRow label="Last 10" value={leg.last10} />
            <DetailRow label="Home/away split" value={leg.homeAwaySplit} />
            <DetailRow label="Handedness" value={leg.handednessMatchup} />
            <DetailRow label="Model probability" value={formatPct(leg.probability)} />
            <DetailRow label="Implied probability" value={formatPct(leg.impliedProbability)} />
            <DetailRow label="Edge" value={formatSignedPct(leg.edge)} />
            <DetailRow label="Data freshness" value={`${leg.dataFreshnessMinutes} min old`} />
          </dl>
        </div>
      ) : null}
    </article>
  );
}
