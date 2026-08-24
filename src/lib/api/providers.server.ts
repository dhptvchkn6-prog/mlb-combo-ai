// Server-side data provider layer.
// Each provider is a separate service interface so real sportsbook / MLB APIs
// can be dropped in later. API keys are read from environment variables inside
// the handler and are NEVER exposed to the client bundle.

import type {
  Game,
  Lineup,
  Market,
  Pitcher,
  Player,
  PlayerStatistics,
  Weather,
} from "../types";

export interface ProviderResult<T> {
  connected: boolean;
  data: T | null;
  error: string | null;
}

export interface ScheduleProvider {
  name: string;
  getTodaysGames(dateIso: string): Promise<ProviderResult<Game[]>>;
}
export interface StatisticsProvider {
  name: string;
  getPlayerStatistics(playerIds: string[]): Promise<ProviderResult<PlayerStatistics[]>>;
}
export interface PitcherProvider {
  name: string;
  getStartingPitchers(gameIds: string[]): Promise<ProviderResult<Pitcher[]>>;
}
export interface LineupProvider {
  name: string;
  getLineups(gameIds: string[]): Promise<ProviderResult<Lineup[]>>;
}
export interface InjuryProvider {
  name: string;
  getInjuries(): Promise<ProviderResult<Player[]>>;
}
export interface OddsProvider {
  name: string;
  getOdds(gameIds: string[]): Promise<ProviderResult<Market[]>>;
}
export interface PlayerPropsProvider {
  name: string;
  getPlayerProps(gameIds: string[]): Promise<ProviderResult<Market[]>>;
}
export interface WeatherProvider {
  name: string;
  getWeather(venues: string[]): Promise<ProviderResult<Record<string, Weather>>>;
}

/** Env var names each provider needs. Values are never logged or returned. */
export const PROVIDER_ENV = {
  schedule: "MLB_SCHEDULE_API_KEY",
  statistics: "MLB_STATS_API_KEY",
  pitchers: "MLB_STATS_API_KEY",
  lineups: "MLB_LINEUPS_API_KEY",
  injuries: "MLB_INJURY_API_KEY",
  odds: "SPORTSBOOK_ODDS_API_KEY",
  props: "SPORTSBOOK_ODDS_API_KEY",
  weather: "WEATHER_API_KEY",
} as const;

export type ProviderKey = keyof typeof PROVIDER_ENV;

function hasKey(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

/** Connection status per provider. Returns booleans only — never key values. */
export function getProviderStatus(): { name: string; connected: boolean }[] {
  return (Object.keys(PROVIDER_ENV) as ProviderKey[]).map((key) => ({
    name: key,
    connected: hasKey(PROVIDER_ENV[key]),
  }));
}

/** True only when every provider required for a live board is configured. */
export function isLiveConnected(): boolean {
  return getProviderStatus().every((p) => p.connected);
}

/**
 * Placeholder live fetch. Until real credentials + clients are wired up this
 * reports "not connected" rather than returning invented data.
 */
export async function fetchLiveBoard(): Promise<ProviderResult<null>> {
  return {
    connected: false,
    data: null,
    error: "Live data provider is not configured.",
  };
}
