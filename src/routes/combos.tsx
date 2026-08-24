import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DemoBanner, LoadingCards, Screen, ScreenTitle, StatePanel } from "@/components/app-chrome";
import { ComboCard } from "@/components/combo-card";
import { useBoard } from "@/lib/use-board";
import type { RiskCategory } from "@/lib/types";

export const Route = createFileRoute("/combos")({
  head: () => ({
    meta: [
      { title: "Combos — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Filter ranked MLB statistical combinations by risk category and number of legs, sorted by model confidence.",
      },
      { property: "og:title", content: "Combos — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Ranked MLB combinations filtered by risk and leg count.",
      },
    ],
  }),
  component: CombosScreen,
});

const RISKS: ("ALL" | RiskCategory)[] = ["ALL", "SAFE", "SMART", "VALUE", "AGGRESSIVE"];
const LEGS = ["ALL", "2", "3", "4", "5+"] as const;

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap-scale min-h-[48px] shrink-0 rounded-full border px-4 text-sm font-bold uppercase tracking-wide ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function CombosScreen() {
  const { board, isLoading, isError, retry } = useBoard();
  const [risk, setRisk] = useState<(typeof RISKS)[number]>("ALL");
  const [legs, setLegs] = useState<(typeof LEGS)[number]>("ALL");

  const results = (board?.combos ?? []).filter((c) => {
    if (risk !== "ALL" && c.risk !== risk) return false;
    if (legs === "ALL") return true;
    if (legs === "5+") return c.legs.length >= 5;
    return c.legs.length === Number(legs);
  });

  return (
    <Screen>
      <ScreenTitle title="Combos" subtitle="Filter by risk and leg count" />
      <DemoBanner update={board?.update ?? null} />

      <div className="-mx-4 overflow-x-auto no-scrollbar px-4">
        <div className="flex w-max gap-2" role="group" aria-label="Filter by risk category">
          {RISKS.map((r) => (
            <Chip key={r} label={r} active={risk === r} onClick={() => setRisk(r)} />
          ))}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto no-scrollbar px-4">
        <div className="flex w-max gap-2" role="group" aria-label="Filter by number of legs">
          {LEGS.map((l) => (
            <Chip
              key={l}
              label={l === "ALL" ? "ALL LEGS" : `${l} LEGS`}
              active={legs === l}
              onClick={() => setLegs(l)}
            />
          ))}
        </div>
      </div>

      {isLoading ? <LoadingCards /> : null}

      {isError ? (
        <StatePanel
          title="API error"
          message="Combos could not be rebuilt because the data request failed."
          actionLabel="Retry"
          onAction={() => retry()}
        />
      ) : null}

      {!isLoading && !isError ? (
        results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{results.length} combos match</p>
            {results.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </div>
        ) : (
          <StatePanel
            title="Not enough qualifying data to build this combo."
            message="No combination matches these filters using picks that clear the confidence and data-quality thresholds."
          />
        )
      ) : null}
    </Screen>
  );
}
