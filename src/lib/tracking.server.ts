// Server-only helpers for grading tracked predictions against final MLB results.

const MLB_BASE = "https://statsapi.mlb.com/api/v1";

export interface FinalScore {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isFinal: boolean;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const child = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** Final scores for one slate date, keyed by MLB gamePk. */
export async function fetchFinalScores(dateIso: string): Promise<Map<string, FinalScore>> {
  const results = new Map<string, FinalScore>();
  let json: unknown;
  try {
    const response = await fetch(`${MLB_BASE}/schedule?sportId=1&date=${dateIso}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return results;
    json = await response.json();
  } catch {
    return results;
  }

  for (const day of asArray(child(json, "dates"))) {
    for (const game of asArray(child(day, "games"))) {
      const gamePk = asNumber(child(game, "gamePk"));
      if (gamePk === null) continue;
      const state = asString(child(child(game, "status"), "abstractGameState"));
      const teams = child(game, "teams");
      const home = child(teams, "home");
      const away = child(teams, "away");
      const homeTeamId = asNumber(child(child(home, "team"), "id"));
      const awayTeamId = asNumber(child(child(away, "team"), "id"));
      const homeScore = asNumber(child(home, "score"));
      const awayScore = asNumber(child(away, "score"));
      if (homeTeamId === null || awayTeamId === null || homeScore === null || awayScore === null) continue;
      results.set(String(gamePk), {
        gameId: String(gamePk),
        homeTeamId: String(homeTeamId),
        awayTeamId: String(awayTeamId),
        homeScore,
        awayScore,
        isFinal: state === "Final",
      });
    }
  }

  return results;
}

export type SettledResult = "WIN" | "LOSS" | "PUSH" | "VOID";

/**
 * Grades a team-side bet against the final score.
 * `line` is the runline from the bettor's perspective (e.g. +1.5 / -1.5).
 */
export function gradeTeamBet(input: {
  marketType: string;
  line: number | null;
  teamScore: number;
  opponentScore: number;
}): { result: SettledResult; actualValue: number } {
  const margin = input.teamScore - input.opponentScore;
  if (input.marketType === "MONEYLINE") {
    if (margin === 0) return { result: "PUSH", actualValue: margin };
    return { result: margin > 0 ? "WIN" : "LOSS", actualValue: margin };
  }
  if (input.marketType === "RUNLINE") {
    const adjusted = margin + (input.line ?? 0);
    if (adjusted === 0) return { result: "PUSH", actualValue: adjusted };
    return { result: adjusted > 0 ? "WIN" : "LOSS", actualValue: adjusted };
  }
  return { result: "VOID", actualValue: margin };
}
