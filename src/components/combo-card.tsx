import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { ConfidenceMeter, RiskBadge } from "./app-chrome";
import { PickLeg } from "./pick-leg";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import type { Combo, Pick } from "@/lib/types";

export function LegRow({ leg, index }: { leg: Pick; index: number }) {
  return <PickLeg leg={leg} index={index} />;
}

export function ComboCard({ combo, showLegs = false }: { combo: Combo; showLegs?: boolean }) {
  return (
    <article className="app-card p-4">
      <Link
        to="/combo/$comboId"
        params={{ comboId: combo.id }}
        aria-label={`${combo.name}, ${combo.legs.length} legs, confidence ${combo.confidence} out of 100`}
        className="tap-scale block active:text-primary"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="break-words text-base font-black uppercase tracking-tight">{combo.name}</p>
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
      </Link>

      <div className="mt-3 space-y-2">
        {(showLegs ? combo.legs : combo.legs.slice(0, 3)).map((leg, i) => (
          <PickLeg key={leg.id} leg={leg} index={i} />
        ))}
        {!showLegs && combo.legs.length > 3 ? (
          <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
            +{combo.legs.length - 3} more leg{combo.legs.length - 3 === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <Link
        to="/combo/$comboId"
        params={{ comboId: combo.id }}
        className="tap-scale mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full bg-primary px-4 text-sm font-black uppercase tracking-wide text-primary-foreground"
      >
        View details
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Link>
    </article>
  );
}
