import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LoadingCards, Screen, ScreenTitle, StatePanel } from "@/components/app-chrome";
import { getPerformance, gradePredictions, snapshotPredictions } from "@/lib/tracking.functions";
import { formatAmerican, formatPct, formatSignedPct } from "@/lib/odds";
import { cn } from "@/lib/utils";
import type { PerformanceBucket } from "@/lib/types";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Model Performance & ROI — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Tracked MLB prediction results: win rate, units, ROI and probability calibration by market, risk tier and confidence band.",
      },
      { property: "og:title", content: "Model Performance & ROI — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Historical accuracy, units won and calibration for every tracked MLB prediction.",
      },
    ],
  }),
  component: PerformanceScreen,
});

function unitsTone(units: number) {
  return units > 0 ? "text-safe" : units < 0 ? "text-destructive" : "text-foreground";
}

function BucketTable({ title, buckets }: { title: string; buckets: PerformanceBucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <section className="app-card p-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      <div className="mt-2 space-y-1">
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{bucket.label}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {bucket.wins}W-{bucket.losses}L{bucket.pushes ? `-${bucket.pushes}P` : ""}
                {bucket.pending ? ` · ${bucket.pending} pending` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("text-sm font-black tabular-nums", unitsTone(bucket.units))}>
                {bucket.units > 0 ? "+" : ""}
                {bucket.units.toFixed(2)}u
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatPct(bucket.winRate)} · ROI {formatSignedPct(bucket.roi)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformanceScreen() {
  const fetchPerformance = useServerFn(getPerformance);
  const snapshot = useServerFn(snapshotPredictions);
  const grade = useServerFn(gradePredictions);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["performance"],
    queryFn: () => fetchPerformance(),
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: async () => {
      await snapshot();
      await grade();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance"] }),
  });

  const summary = query.data?.summary ?? null;
  const recent = query.data?.recent ?? [];

  return (
    <Screen>
      <ScreenTitle title="Performance" subtitle="Tracked predictions, units and calibration" />

      <button
        type="button"
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        className="tap-scale min-h-[48px] w-full rounded-full bg-primary text-sm font-black uppercase tracking-wide text-primary-foreground disabled:opacity-60"
      >
        {sync.isPending ? "Syncing…" : "Record today's picks & grade results"}
      </button>

      {query.isLoading ? <LoadingCards count={2} /> : null}
      {query.isError ? (
        <StatePanel
          title="Tracking unavailable"
          message="The performance store could not be reached. No estimated results are shown."
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      ) : null}

      {summary ? (
        <>
          <section className="app-card p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              All tracked predictions
            </p>
            <p className={cn("mt-1 text-3xl font-black tabular-nums", unitsTone(summary.overall.units))}>
              {summary.overall.units > 0 ? "+" : ""}
              {summary.overall.units.toFixed(2)} units
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-surface p-2">
                <p className="text-muted-foreground">Win rate</p>
                <p className="font-black tabular-nums">{formatPct(summary.overall.winRate)}</p>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <p className="text-muted-foreground">ROI</p>
                <p className="font-black tabular-nums">{formatSignedPct(summary.overall.roi)}</p>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <p className="text-muted-foreground">Brier</p>
                <p className="font-black tabular-nums">
                  {summary.brierScore === null ? "—" : summary.brierScore.toFixed(3)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {summary.gradedCount} graded · {summary.overall.pending} pending. Units assume one flat unit per
              bet at the recorded price.
            </p>
          </section>

          <section className="app-card p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Calibration
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Predicted probability vs actual hit rate. Closer lines mean a better-calibrated model.
            </p>
            <div className="mt-2 space-y-1">
              {summary.calibration.map((band) => (
                <div key={band.bucket} className="rounded-lg bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                    <span>{band.bucket}</span>
                    <span className="tabular-nums text-muted-foreground">
                      pred {formatPct(band.predicted)} · actual {formatPct(band.actual)} · n={band.samples}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.round((band.actual ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <BucketTable title="By market" buckets={summary.byMarket} />
          <BucketTable title="By risk tier" buckets={summary.byRisk} />
          <BucketTable title="By confidence band" buckets={summary.byConfidence} />
          <BucketTable title="By model version" buckets={summary.byModelVersion} />

          <section className="app-card p-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Recent predictions
            </h2>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing recorded yet. Tap the sync button above to store today's qualifying picks.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {recent.map((row) => (
                  <li
                    key={row.predictionId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{row.subject}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.gameDate} · {row.marketLabel} · {formatAmerican(row.american)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider",
                        row.result === "WIN" && "bg-safe/15 text-safe",
                        row.result === "LOSS" && "bg-destructive/15 text-destructive",
                        row.result === "PENDING" && "bg-surface-2 text-muted-foreground",
                        (row.result === "PUSH" || row.result === "VOID") && "bg-border text-muted-foreground",
                      )}
                    >
                      {row.result}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Past model performance does not guarantee future results.
      </p>
    </Screen>
  );
}
