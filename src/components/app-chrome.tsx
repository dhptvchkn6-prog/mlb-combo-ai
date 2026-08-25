import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { DataQuality, DataUpdate, RiskCategory } from "@/lib/types";

const NAV = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/games", label: "Games", icon: "⚾" },
  { to: "/combos", label: "Combos", icon: "🔥" },
  { to: "/stats", label: "Stats", icon: "📊" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-1">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <Link
              to={item.to}
              aria-label={item.label}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ "data-active": "true" }}
              className="tap-scale flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground data-[active=true]:text-primary"
            >
              <span aria-hidden className="text-lg leading-none">
                {item.icon}
              </span>
              <span className="uppercase">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md screen-pad pt-4">
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="pt-2">
      <h1 className="text-2xl font-black uppercase tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}

export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => router.history.back()}
      className="tap-scale inline-flex min-h-[48px] items-center gap-1 rounded-full border border-border bg-surface px-4 text-sm font-semibold"
    >
      <ChevronLeft aria-hidden className="h-4 w-4" />
      {label}
    </button>
  );
}

export function DataStatusBanner({ update }: { update: DataUpdate | null }) {
  if (!update) return null;
  return (
    <section role="status" className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">Live Data</p>
      <p className="mt-1 text-sm font-semibold">{update.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Last updated {new Date(update.lastUpdatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </p>
    </section>
  );
}

const RISK_STYLE: Record<RiskCategory, string> = {
  SAFE: "border-safe/50 bg-safe/15 text-safe",
  SMART: "border-smart/50 bg-smart/15 text-smart",
  VALUE: "border-value/50 bg-value/15 text-value",
  AGGRESSIVE: "border-aggressive/50 bg-aggressive/15 text-aggressive",
};

const RISK_ICON: Record<RiskCategory, string> = {
  SAFE: "🛡️",
  SMART: "🔥",
  VALUE: "💰",
  AGGRESSIVE: "🚀",
};

export function RiskBadge({ risk }: { risk: RiskCategory }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        RISK_STYLE[risk],
      )}
    >
      <span aria-hidden>{RISK_ICON[risk]}</span>
      {risk}
    </span>
  );
}

export function QualityBadge({ quality }: { quality: DataQuality }) {
  const label = { HIGH: "High data quality", MEDIUM: "Medium data quality", LOW: "Low data quality" }[
    quality
  ];
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        quality === "HIGH"
          ? "border-primary/50 bg-primary/15 text-primary"
          : quality === "MEDIUM"
            ? "border-value/50 bg-value/15 text-value"
            : "border-destructive/50 bg-destructive/15 text-destructive",
      )}
    >
      DATA {quality}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Confidence
        </span>
        <span className="text-sm font-black tabular-nums">{value} / 100</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Model confidence ${value} out of 100`}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
    </div>
  );
}

export function StatePanel({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="app-card p-5 text-center">
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="tap-scale mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading board…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-card h-32 animate-pulse bg-surface-2/50" />
      ))}
    </div>
  );
}
