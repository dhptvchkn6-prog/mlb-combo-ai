import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { ConfidenceMeter, RiskBadge } from "./app-chrome";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import type { Combo, Pick } from "@/lib/types";

export function LegRow({ leg, index }: { leg: Pick; index: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-2/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Leg {index + 1}
      </p>
      <p className="mt-0.5 text-sm font-bold">{leg.selection}</p>
      <p className="text-xs text-muted-foreground">{leg.marketLabel}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-bold tabular-nums text-primary">{formatPct(leg.probability)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Implied</dt>
          <dd className="font-bold tabular-nums">{formatPct(leg.impliedProbability)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Odds</dt>
          <dd className="font-bold tabular-nums">{formatAmerican(leg.odds?.american)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ComboCard({ combo, showLegs = false }: { combo: Combo; showLegs?: boolean }) {
  return (
    <Link
      to="/combo/$comboId"
      params={{ comboId: combo.id }}
      aria-label={`${combo.name}, ${combo.legs.length} legs, confidence ${combo.confidence} out of 100`}
      className="tap-scale app-card block p-4 active:border-primary/60"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black uppercase tracking-tight">{combo.name}</p>
          <p className="text-xs font-semibold text-muted-foreground">
            {combo.legs.length} LEGS · {formatAmerican(combo.combinedOdds)}
          </p>
        </div>
        <RiskBadge risk={combo.risk} />
      </div>

      <div className="mt-3">
        <ConfidenceMeter value={combo.confidence} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Model prob</dt>
          <dd className="text-sm font-black tabular-nums text-primary">
            {formatPct(combo.modelProbability)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Implied</dt>
          <dd className="text-sm font-black tabular-nums">{formatPct(combo.impliedProbability)}</dd>
        </div>
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Edge</dt>
          <dd className="text-sm font-black tabular-nums">
            {formatSignedPct(combo.estimatedEdge)}
          </dd>
        </div>
      </dl>

      {showLegs ? (
        <div className="mt-3 space-y-2">
          {combo.legs.map((leg, i) => (
            <LegRow key={leg.id} leg={leg} index={i} />
          ))}
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {combo.legs.map((leg) => (
            <li key={leg.id} className="truncate text-xs text-muted-foreground">
              • {leg.selection} — {leg.marketLabel} ({formatAmerican(leg.odds?.american)})
            </li>
          ))}
        </ul>
      )}

      <span className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full bg-primary px-4 text-sm font-black uppercase tracking-wide text-primary-foreground">
        View details
        <ChevronRight aria-hidden className="h-4 w-4" />
      </span>
    </Link>
  );
}
