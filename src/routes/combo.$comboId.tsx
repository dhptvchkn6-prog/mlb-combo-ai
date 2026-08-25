import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  BackButton,
  ConfidenceMeter,
  DataStatusBanner,
  LoadingCards,
  RiskBadge,
  Screen,
  StatePanel,
} from "@/components/app-chrome";
import { PickLeg } from "@/components/pick-leg";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import { useBoard } from "@/lib/use-board";
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

function ComboDetails() {
  const { comboId } = useParams({ from: "/combo/$comboId" });
  const { board, isLoading, isError, retry } = useBoard();
  const combo = board?.combos.find((c) => c.id === comboId) ?? null;

  return (
    <Screen>
      <BackButton />
      <DataStatusBanner update={board?.update ?? null} />

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
              <PickLeg key={leg.id} leg={leg} index={i} defaultOpen />
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
