import { createFileRoute } from "@tanstack/react-router";

import { DataStatusBanner, Screen, ScreenTitle } from "@/components/app-chrome";
import { SPORTSBOOKS, useSettings } from "@/lib/settings";
import { useBoard } from "@/lib/use-board";
import type { RefreshInterval, RiskPreference, Settings } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Pro Baseball Combos" },
      {
        name: "description",
        content:
          "Set risk preference, minimum confidence, preferred legs, sportsbook, refresh interval and data mode.",
      },
      { property: "og:title", content: "Settings — Pro Baseball Combos" },
      {
        property: "og:description",
        content: "Risk preference, confidence threshold, legs, sportsbook and refresh controls.",
      },
    ],
  }),
  component: SettingsScreen,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-card p-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function OptionRow<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto no-scrollbar px-1">
      <div className="flex w-max gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`tap-scale min-h-[48px] shrink-0 rounded-full border px-4 text-sm font-bold uppercase ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen() {
  const { settings, update, reset, timezone } = useSettings();
  const { board, refresh, isRefreshing } = useBoard();
  return (
    <Screen>
      <ScreenTitle title="Settings" subtitle="All controls work by tapping" />
      <DataStatusBanner update={board?.update ?? null} />

      <Section title="Risk preference">
        <OptionRow<RiskPreference>
          label="Risk preference"
          value={settings.riskPreference}
          onChange={(v) => update("riskPreference", v)}
          options={[
            { value: "SAFE", label: "Safe" },
            { value: "BALANCED", label: "Balanced" },
            { value: "AGGRESSIVE", label: "Aggressive" },
          ]}
        />
      </Section>

      <Section title="Minimum confidence">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Threshold</span>
          <span className="text-lg font-black tabular-nums">{settings.minConfidence}</span>
        </div>
        <input
          type="range"
          min={50}
          max={95}
          step={1}
          value={settings.minConfidence}
          aria-label="Minimum confidence threshold"
          onChange={(e) => update("minConfidence", Number(e.target.value))}
          className="mt-3 h-10 w-full accent-[var(--primary)]"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>50</span>
          <span>95</span>
        </div>
        <div className="mt-2 flex gap-2">
          {[55, 65, 75, 85].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update("minConfidence", v)}
              aria-label={`Set minimum confidence to ${v}`}
              className="tap-scale min-h-[44px] flex-1 rounded-full border border-border bg-surface text-sm font-bold tabular-nums"
            >
              {v}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Preferred number of legs">
        <OptionRow<Settings["preferredLegs"]>
          label="Preferred number of legs"
          value={settings.preferredLegs}
          onChange={(v) => update("preferredLegs", v)}
          options={[
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
            { value: 5, label: "5+" },
          ]}
        />
      </Section>

      <Section title="Preferred sportsbook">
        <select
          value={settings.sportsbook}
          aria-label="Preferred sportsbook"
          onChange={(e) => update("sportsbook", e.target.value)}
          className="min-h-[52px] w-full rounded-xl border border-border bg-surface px-4 text-base font-semibold"
        >
          {SPORTSBOOKS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Timezone">
        <p className="text-sm font-semibold">{timezone}</p>
        <p className="text-xs text-muted-foreground">Detected automatically from your device.</p>
      </Section>

      <Section title="Refresh interval">
        <OptionRow<RefreshInterval>
          label="Refresh interval"
          value={settings.refreshInterval}
          onChange={(v) => update("refreshInterval", v)}
          options={[
            { value: "MANUAL", label: "Manual" },
            { value: "5", label: "5 min" },
            { value: "15", label: "15 min" },
            { value: "30", label: "30 min" },
          ]}
        />
        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing}
          className="tap-scale mt-3 min-h-[48px] w-full rounded-full bg-primary text-sm font-black uppercase tracking-wide text-primary-foreground disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing…" : "Refresh now"}
        </button>
      </Section>

      <Section title="Live data sources">
        <p className="text-xs text-muted-foreground">
          {(board?.update.sources ?? []).map((s) => `${s.name} (${s.connected ? "on" : "off"})`).join(", ") ||
            "Loading source status"}
        </p>
      </Section>

      <button
        type="button"
        onClick={reset}
        className="tap-scale min-h-[48px] w-full rounded-full border border-border bg-surface text-sm font-bold uppercase tracking-wide"
      >
        Reset to defaults
      </button>
    </Screen>
  );
}
