import { createFileRoute, useParams } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  BackButton,
  ConfidenceMeter,
  DemoBanner,
  LoadingCards,
  QualityBadge,
  RiskBadge,
  Screen,
  StatePanel,
} from "@/components/app-chrome";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import { useBoard } from "@/lib/use-board";
import type { Pick } from "@/lib/types";

export const Route = createFileRoute("/combo/$comboId")({
  head: () => ({
    meta: [
      { title: "Combo Details — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Leg-by-leg combo breakdown with model probability, implied probability, estimated edge and the factors behind each pick.",
      },
      { property: "og:title", content: "Combo Details — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Leg-by-leg model probability, implied probability and estimated edge.",
      },
    ],
  }),
  component: ComboDetails,
});

function LegDetail({ leg, index }: { leg: Pick; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="app-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Leg {index + 1}
          </p>
          <p className="truncate text-base font-black">{leg.selection}</p>
          <p className="text-xs text-muted-foreground">{leg.marketLabel}</p>
        </div>
        <QualityBadge quality={leg.dataQuality} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Line</dt>
          <dd className="font-black tabular-nums">{leg.line ?? "—"}</dd>
        </div>
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Odds</dt>
          <dd className="font-black tabular-nums">{formatAmerican(leg.odds?.american)}</dd>
        </div>
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Model probability</dt>
          <dd className="font-black tabular-nums text-primary">{formatPct(leg.probability)}</dd>
        </div>
        <div className="rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Implied probability</dt>
          <dd className="font-black tabular-nums">{formatPct(leg.impliedProbability)}</dd>
        </div>
        <div className="col-span-2 rounded-lg bg-surface-2/70 p-2">
          <dt className="text-muted-foreground">Estimated edge</dt>
          <dd className="font-black tabular-nums">{formatSignedPct(leg.edge)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap-scale mt-3 flex min-h-[48px] w-full items-center justify-between rounded-xl border border-border bg-surface px-4 text-sm font-bold"
      >
        Why this pick?
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <dl className="mt-2 rounded-xl border border-border bg-surface-2/50 p-3">
          {leg.reasoning.map((f) => (
            <div
              key={f.label}
              className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0"
            >
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd
                className={`text-right text-xs font-semibold ${
                  !f.available
                    ? "text-muted-foreground italic"
                    : f.impact === "POSITIVE"
                      ? "text-primary"
                      : f.impact === "NEGATIVE"
                        ? "text-warning"
                        : ""
                }`}
              >
                {f.value}
                {f.available && f.impact !== "NEUTRAL" ? (
                  <span className="ml-1 text-[10px] uppercase">
                    ({f.impact === "POSITIVE" ? "supports" : "caution"})
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function ComboDetails() {
  const { comboId } = useParams({ from: "/combo/$comboId" });
  const { board, isLoading, isError, retry } = useBoard();
  const combo = board?.combos.find((c) => c.id === comboId) ?? null;

  return (
    <Screen>
      <BackButton />
      <DemoBanner update={board?.update ?? null} />

      {isLoading ? <LoadingCards /> : null}
      {isError ? (
        <StatePanel
          title="API error"
          message="This combo could not be loaded."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}
      {!isLoading && !isError && !combo ? (
        <StatePanel
          title="Combo no longer available"
          message="This combination was rebuilt or no longer clears the model thresholds."
        />
      ) : null}

      {combo ? (
        <>
          <section className="app-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black uppercase tracking-tight">
                  {combo.name}
                </h1>
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
                <dt className="text-muted-foreground">Model</dt>
                <dd className="text-sm font-black tabular-nums text-primary">
                  {formatPct(combo.modelProbability)}
                </dd>
              </div>
              <div className="rounded-lg bg-surface-2/70 p-2">
                <dt className="text-muted-foreground">Implied</dt>
                <dd className="text-sm font-black tabular-nums">
                  {formatPct(combo.impliedProbability)}
                </dd>
              </div>
              <div className="rounded-lg bg-surface-2/70 p-2">
                <dt className="text-muted-foreground">Edge</dt>
                <dd className="text-sm font-black tabular-nums">
                  {formatSignedPct(combo.estimatedEdge)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{combo.reasoning}</p>
          </section>

          <div className="space-y-3">
            {combo.legs.map((leg, i) => (
              <LegDetail key={leg.id} leg={leg} index={i} />
            ))}
          </div>

          <section className="app-card border-primary/40 p-4 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">
              Model score
            </p>
            <p className="text-5xl font-black tabular-nums">{combo.confidence}</p>
            <p className="text-xs text-muted-foreground">out of 100</p>
            <p className="mt-2 text-xs text-muted-foreground">
              This is a model confidence score, not a guarantee.
            </p>
          </section>
        </>
      ) : null}
    </Screen>
  );
}
