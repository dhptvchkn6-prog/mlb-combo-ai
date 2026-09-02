import { formatAmerican, formatPct } from "@/lib/odds";
import type { BestBet } from "@/lib/types";
import { PickCard } from "./pick-card";

export function BestBetSection({ bestBet }: { bestBet: BestBet | null }) {
  if (!bestBet) {
    return (
      <section className="app-card border-dashed p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">Best bet of the day</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No bet currently clears the edge, confidence and data-quality thresholds. Nothing is shown rather
          than inventing a play.
        </p>
      </section>
    );
  }

  const { pick } = bestBet;

  return (
    <section className="space-y-2">
      <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 shadow-glow">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">Best bet of the day</p>
        <p className="mt-1 text-sm font-bold">
          {pick.selectionType === "PLAYER_PROP" ? pick.playerName : pick.teamName} ·{" "}
          {formatAmerican(pick.odds?.american)} · model {formatPct(pick.probability)}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {bestBet.rationale.map((line) => (
            <li key={line} className="break-words">
              • {line}
            </li>
          ))}
        </ul>
      </div>
      <PickCard pick={pick} />
    </section>
  );
}
