// Scoring engine — pure, live data-in / ranked data-out. No network, no UI.

import { americanToDecimal, americanToImplied, decimalToAmerican } from "../odds";
import {
  MODEL_VERSION,
  breakEvenProbability,
  calibrateProbability,
  expectedValuePer100,
  freshnessFor,
  rankRationale,
  rankScoreFor,
} from "./metrics";
import type {
  BestBet,
  Combo,
  CorrelationRisk,
  DataQuality,
  Game,
  Market,
  Pick,
  Player,
  PlayerStatistics,
  ProjectionFactor,
  RiskCategory,
  Team,
  TeamStatistics,
} from "../types";


export interface EngineInput {
  games: Game[];
  players: Player[];
  statistics: PlayerStatistics[];
  teamStatistics: TeamStatistics[];
  markets: Market[];
  nowIso: string;
  minConfidence?: number;
  minEdgePct?: number;
}

export interface EngineOutput {
  picks: Pick[];
  combos: Combo[];
  bestBet: BestBet | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function factor(
  label: string,
  value: string | null,
  impact: ProjectionFactor["impact"] = "NEUTRAL",
): ProjectionFactor {
  return {
    label,
    value: value ?? "Not available",
    available: value !== null,
    impact: value === null ? "NEUTRAL" : impact,
  };
}

function fmt(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function fmtRuns(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2);
}

function qualityFromScore(score: number): DataQuality {
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

function riskFor(probability: number, edge: number | null, marketType: Market["marketType"]): RiskCategory {
  if (marketType === "RUNLINE") return probability >= 0.53 ? "SMART" : "AGGRESSIVE";
  if ((edge ?? 0) >= 0.045) return "VALUE";
  if (probability >= 0.62) return "SAFE";
  if (probability >= 0.54) return "SMART";
  return "AGGRESSIVE";
}

type V2Keys =
  | "decimalOdds"
  | "evPer100"
  | "expectedRoi"
  | "breakEvenProbability"
  | "edgePct"
  | "rankScore"
  | "quotes"
  | "bestSportsbook"
  | "movement"
  | "freshness"
  | "playerStatus"
  | "lineupStatus"
  | "battingOrder"
  | "missingInputs"
  | "modelVersion";

export type PickDraft = Omit<Pick, V2Keys>;

interface FinalizeContext {
  market: Market;
  /** 0..1 strength of the statistical evidence behind the raw projection. */
  evidence: number;
  /** 0..1 certainty that the selection will actually be live (lineup, health). */
  availability: number;
  missingInputs: string[];
  playerStatus: Pick["playerStatus"];
  lineupStatus: Pick["lineupStatus"];
  battingOrder: number | null;
}

/**
 * Converts a raw draft into a fully-priced pick:
 * calibrates the probability, derives EV/ROI/break-even, and scores the ranking.
 */
function finalizePick(draft: PickDraft, ctx: FinalizeContext): Pick {
  const american = draft.odds?.american ?? null;
  const implied = american === null ? null : americanToImplied(american);
  const probability = calibrateProbability(draft.probability, implied, ctx.evidence);
  const edge = implied === null ? null : probability - implied;
  const evPer100 = american === null ? null : expectedValuePer100(probability, american);
  const freshness = freshnessFor(draft.dataFreshnessMinutes);

  const qualityBonus = draft.dataQuality === "HIGH" ? 22 : draft.dataQuality === "MEDIUM" ? 13 : 4;
  const confidence = Math.round(
    clamp(
      probability * 55 +
        qualityBonus +
        clamp((edge ?? 0) * 160, -15, 15) +
        ctx.availability * 10 -
        clamp(draft.dataFreshnessMinutes / 6, 0, 10) -
        ctx.missingInputs.length * 2,
      0,
      100,
    ),
  );

  const quotes = ctx.market.quotes ?? [];
  const pick: Pick = {
    ...draft,
    probability,
    impliedProbability: implied,
    edge,
    confidence,
    risk: riskFor(probability, edge, draft.marketType),
    decimalOdds: american === null ? null : americanToDecimal(american),
    evPer100,
    expectedRoi: evPer100 === null ? null : evPer100 / 100,
    breakEvenProbability: american === null ? null : breakEvenProbability(american),
    edgePct: edge === null ? null : edge * 100,
    rankScore: 0,
    quotes,
    bestSportsbook: draft.odds?.sportsbook ?? null,
    movement: ctx.market.movement,
    freshness,
    playerStatus: ctx.playerStatus,
    lineupStatus: ctx.lineupStatus,
    battingOrder: ctx.battingOrder,
    missingInputs: ctx.missingInputs,
    modelVersion: MODEL_VERSION,
  };

  pick.rankScore = rankScoreFor({
    expectedRoi: pick.expectedRoi,
    edge: pick.edge,
    confidence: pick.confidence,
    dataQuality: pick.dataQuality,
    freshness: pick.freshness,
    availabilityScore: ctx.availability,
    american,
    quoteCount: quotes.length,
  });

  return pick;
}



function hasRequiredMarketData(market: Market): boolean {
  return Boolean(market.gameId && market.teamId && market.odds && Number.isFinite(market.odds?.american));
}

function teamSide(game: Game, teamId: string): { team: Team; opponent: Team; isHome: boolean } | null {
  if (game.homeTeam.id === teamId) return { team: game.homeTeam, opponent: game.awayTeam, isHome: true };
  if (game.awayTeam.id === teamId) return { team: game.awayTeam, opponent: game.homeTeam, isHome: false };
  return null;
}

function freshness(nowIso: string, updatedAt: string): number {
  const value = Math.max(0, (Date.parse(nowIso) - Date.parse(updatedAt)) / 60000);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function createTeamPick(
  market: Market,
  game: Game,
  teamStats: Map<string, TeamStatistics>,
  nowIso: string,
): Pick | null {
  if (!market.teamId || !market.odds) return null;
  const side = teamSide(game, market.teamId);
  if (!side) return null;
  const stats = teamStats.get(side.team.id);
  const oppStats = teamStats.get(side.opponent.id);
  if (!stats || !oppStats) return null;

  const siteWinPct = side.isHome ? stats.homeWinPct : stats.awayWinPct;
  const oppSiteWinPct = side.isHome ? oppStats.awayWinPct : oppStats.homeWinPct;
  const winPctDelta = stats.winPct - oppStats.winPct;
  const siteDelta = (siteWinPct ?? stats.winPct) - (oppSiteWinPct ?? oppStats.winPct);
  const offenseDelta = (stats.runsPerGame ?? 4.4) - (oppStats.runsAllowedPerGame ?? 4.4);
  const preventionDelta = (oppStats.runsPerGame ?? 4.4) - (stats.runsAllowedPerGame ?? 4.4);
  const pitcher = side.isHome ? game.homePitcher : game.awayPitcher;
  const opposingPitcher = side.isHome ? game.awayPitcher : game.homePitcher;
  const pitcherEraDelta = (opposingPitcher?.era ?? 4.2) - (pitcher?.era ?? 4.2);
  const injuryDelta = oppStats.injuries - stats.injuries;
  const homeBump = side.isHome ? 0.025 : -0.015;

  let projection =
    0.5 +
    winPctDelta * 0.42 +
    siteDelta * 0.16 +
    offenseDelta * 0.018 +
    preventionDelta * 0.018 +
    pitcherEraDelta * 0.018 +
    injuryDelta * 0.006 +
    homeBump;

  if (market.marketType === "RUNLINE") {
    projection += (market.line ?? 0) > 0 ? 0.095 : -0.075;
  }

  const probability = clamp(projection, market.marketType === "RUNLINE" ? 0.28 : 0.36, 0.76);
  const implied = americanToImplied(market.odds.american);
  const edge = probability - implied;
  let qualityScore = 0;
  if (stats.wins + stats.losses >= 20) qualityScore += 1;
  if (siteWinPct !== null && oppSiteWinPct !== null) qualityScore += 1;
  if (stats.runsPerGame !== null || stats.battingAverage !== null) qualityScore += 1;
  if (pitcher && opposingPitcher) qualityScore += 1;
  if (market.odds) qualityScore += 1;
  const dataQuality = qualityFromScore(qualityScore);
  const freshMin = freshness(nowIso, market.updatedAt);
  const confidence = Math.round(
    clamp(
      probability * 62 +
        (dataQuality === "HIGH" ? 24 : dataQuality === "MEDIUM" ? 14 : 4) +
        clamp(edge * 125, -14, 14) -
        clamp(freshMin / 45, 0, 8),
      0,
      100,
    ),
  );

  const marketLabel = market.marketType === "RUNLINE" ? market.label : "Moneyline";
  const reasoning: ProjectionFactor[] = [
    factor("Selection", `${side.team.name} ${marketLabel}`),
    factor("Opponent", side.opponent.name),
    factor("Game time", game.startTime),
    factor("Starting pitcher", pitcher ? `${pitcher.name} (${pitcher.era ?? "—"} ERA)` : null),
    factor(
      "Opposing pitcher",
      opposingPitcher ? `${opposingPitcher.name} (${opposingPitcher.era ?? "—"} ERA)` : null,
    ),
    factor("Season record", `${stats.wins}-${stats.losses} (${fmt(stats.winPct, 3)})`),
    factor("Home/away split", `${side.isHome ? "Home" : "Away"} ${fmt(siteWinPct, 3)}`),
    factor("Opponent split", `${side.isHome ? "Away" : "Home"} ${fmt(oppSiteWinPct, 3)}`),
    factor("Runs per game", fmtRuns(stats.runsPerGame), (stats.runsPerGame ?? 0) >= (oppStats.runsPerGame ?? 0) ? "POSITIVE" : "NEGATIVE"),
    factor("Runs allowed per game", fmtRuns(stats.runsAllowedPerGame)),
    factor("Bullpen", stats.bullpenEra === null ? null : `${stats.bullpenEra.toFixed(2)} ERA`),
    factor("Player availability", `${stats.injuries} listed injuries`),
    factor("Park", game.venue),
    factor(
      "Weather",
      game.weather
        ? `${game.weather.temperatureF ?? "—"}°F, ${game.weather.conditions ?? "conditions unavailable"}`
        : null,
    ),
    factor("Current odds", `${market.odds.sportsbook} ${market.odds.american > 0 ? "+" : ""}${market.odds.american}`),
    factor("Data freshness", `${freshMin} min old`),
  ];

  const missingInputs: string[] = [];
  if (!pitcher) missingInputs.push("starting pitcher");
  if (!opposingPitcher) missingInputs.push("opposing pitcher");
  if (siteWinPct === null || oppSiteWinPct === null) missingInputs.push("home/away splits");
  if (stats.runsPerGame === null) missingInputs.push("runs per game");
  if (stats.bullpenEra === null) missingInputs.push("bullpen ERA");
  if (!game.weather) missingInputs.push("weather");
  const evidence = clamp(qualityScore / 5, 0, 1);
  const availability =
    (game.lineupStatus === "CONFIRMED" ? 0.5 : game.lineupStatus === "PROJECTED" ? 0.35 : 0.15) +
    (pitcher && opposingPitcher ? 0.5 : 0.2);

  return finalizePick({
    id: `pick-${market.id}`,
    marketId: market.id,
    gameId: game.id,
    selectionType: "TEAM_BET",
    playerId: null,
    playerName: null,
    teamId: side.team.id,
    teamName: side.team.name,
    teamAbbreviation: side.team.abbreviation,
    opponentTeamId: side.opponent.id,
    opponentName: side.opponent.name,
    opponentAbbreviation: side.opponent.abbreviation,
    gameTime: game.startTime,
    venue: game.venue,
    startingPitcher: pitcher?.name ?? null,
    opposingPitcher: opposingPitcher?.name ?? null,
    selection: side.team.name,
    marketType: market.marketType,
    marketLabel,
    line: market.line,
    odds: market.odds,
    projection: probability,
    projectionLabel: `Projected win probability ${Math.round(probability * 1000) / 10}%`,
    probability,
    impliedProbability: implied,
    edge,
    confidence,
    risk: riskFor(probability, edge, market.marketType),
    reasoning,
    dataQuality,
    seasonStats: `${stats.wins}-${stats.losses}, ${fmtRuns(stats.runsPerGame)} R/G, ${fmtRuns(stats.runsAllowedPerGame)} RA/G`,
    last5: "Team recent form unavailable from the connected odds feed",
    last10: "Team recent form unavailable from the connected odds feed",
    homeAwaySplit: `${side.isHome ? "Home" : "Away"} win pct ${fmt(siteWinPct, 3)}`,
    handednessMatchup: `SP ${pitcher?.throws ?? "—"} vs opposing SP ${opposingPitcher?.throws ?? "—"}`,
    dataFreshnessMinutes: freshMin,
    updatedAt: nowIso,
  }, {
    market,
    evidence,
    availability: clamp(availability, 0, 1),
    missingInputs,
    playerStatus: null,
    lineupStatus: game.lineupStatus,
    battingOrder: null,
  });
}

function createPlayerPick(
  market: Market,
  game: Game,
  player: Player,
  stats: PlayerStatistics,
  nowIso: string,
): Pick | null {
  if (!market.teamId || !market.odds) return null;
  if (player.status === "OUT") return null;
  const side = teamSide(game, player.teamId);
  if (!side) return null;
  const isPitcherProp = market.marketType === "STRIKEOUTS_OVER";
  const opposingPitcher = side.isHome ? game.awayPitcher : game.homePitcher;
  if (!isPitcherProp && !opposingPitcher) return null;

  const recent = (stats.last5.average + stats.last10.average) / 2;
  const site = side.isHome ? stats.home.average : stats.away.average;
  const platoon = opposingPitcher?.throws === "L" ? stats.vsLeft.average : stats.vsRight.average;
  const opponentSplit = stats.opponent?.average ?? null;
  let projection = stats.season.average * 0.42 + recent * 0.26 + site * 0.16 + platoon * 0.16;
  if (opponentSplit !== null) projection = projection * 0.9 + opponentSplit * 0.1;

  const wind = game.weather?.windMph ?? null;
  const windOut = game.weather?.windDirection?.startsWith("Out") ?? false;
  if (wind !== null && windOut) projection *= 1.02;
  if (wind !== null && !windOut && wind > 10) projection *= 0.99;

  let probability: number;
  const line = market.line ?? 0.5;
  if (market.marketType === "TOTAL_BASES_OVER") {
    probability = clamp(0.5 + (projection - line) * 0.22, 0.22, 0.84);
  } else if (market.marketType === "RUNS_RBI_OVER") {
    probability = clamp(0.5 + (projection - line) * 0.18, 0.22, 0.82);
  } else if (isPitcherProp) {
    probability = clamp(0.5 + (projection - line) * 0.14, 0.2, 0.86);
  } else {
    probability = clamp(1 - Math.pow(1 - clamp(projection, 0.01, 0.95), 4), 0.2, 0.9);
  }
  if (player.status === "QUESTIONABLE") probability *= 0.94;

  const implied = americanToImplied(market.odds.american);
  const edge = probability - implied;
  let qualityScore = 0;
  if (stats.sampleSize >= 120) qualityScore += 2;
  else if (stats.sampleSize >= 50) qualityScore += 1;
  if (stats.last5.games >= 5 && stats.last10.games >= 10) qualityScore += 1;
  if (opposingPitcher || isPitcherProp) qualityScore += 1;
  if (market.odds) qualityScore += 1;
  const dataQuality = qualityFromScore(qualityScore);
  const freshMin = freshness(nowIso, market.updatedAt);
  const confidence = Math.round(
    clamp(
      probability * 64 +
        (dataQuality === "HIGH" ? 22 : dataQuality === "MEDIUM" ? 13 : 4) +
        clamp(edge * 120, -12, 12) -
        clamp(freshMin / 45, 0, 8) -
        (player.status === "QUESTIONABLE" ? 8 : 0),
      0,
      100,
    ),
  );

  const missingInputs: string[] = [];
  if (!opposingPitcher) missingInputs.push("opposing pitcher");
  if (stats.opponent === null) missingInputs.push("opponent split");
  if (stats.last5.games < 5) missingInputs.push("last 5 games");
  if (!game.weather) missingInputs.push("weather");
  if (game.lineupStatus !== "CONFIRMED") missingInputs.push("confirmed lineup");
  const evidence = clamp(qualityScore / 5, 0, 1) * (stats.sampleSize >= 50 ? 1 : 0.7);
  const availability =
    (player.status === "ACTIVE" ? 0.55 : player.status === "QUESTIONABLE" ? 0.25 : 0.1) +
    (game.lineupStatus === "CONFIRMED" ? 0.45 : game.lineupStatus === "PROJECTED" ? 0.3 : 0.1);

  return finalizePick({
    id: `pick-${market.id}`,
    marketId: market.id,
    gameId: game.id,
    selectionType: "PLAYER_PROP",
    playerId: player.id,
    playerName: player.name,
    teamId: side.team.id,
    teamName: side.team.name,
    teamAbbreviation: side.team.abbreviation,
    opponentTeamId: side.opponent.id,
    opponentName: side.opponent.name,
    opponentAbbreviation: side.opponent.abbreviation,
    gameTime: game.startTime,
    venue: game.venue,
    startingPitcher: side.isHome ? game.homePitcher?.name ?? null : game.awayPitcher?.name ?? null,
    opposingPitcher: opposingPitcher?.name ?? null,
    selection: player.name,
    marketType: market.marketType,
    marketLabel: market.label,
    line: market.line,
    odds: market.odds,
    projection,
    projectionLabel: `AI projection ${projection.toFixed(2)}`,
    probability,
    impliedProbability: implied,
    edge,
    confidence,
    risk: riskFor(probability, edge, market.marketType),
    reasoning: [
      factor("Player", player.name),
      factor("Team", side.team.name),
      factor("Opponent", side.opponent.name),
      factor("Game time", game.startTime),
      factor("Starting pitcher", side.isHome ? game.homePitcher?.name ?? null : game.awayPitcher?.name ?? null),
      factor("Opposing pitcher", opposingPitcher?.name ?? null),
      factor("Season stats", `${stats.season.average.toFixed(3)} over ${stats.season.games} G`),
      factor("Last 5", `${stats.last5.average.toFixed(3)} over ${stats.last5.games} G`),
      factor("Last 10", `${stats.last10.average.toFixed(3)} over ${stats.last10.games} G`),
      factor("Home/away split", `${side.isHome ? "Home" : "Away"} ${site.toFixed(3)}`),
      factor("Handedness matchup", `${player.bats} vs ${opposingPitcher?.throws ?? "—"}`),
      factor("Market", market.label),
      factor("Line", market.line !== null ? String(market.line) : null),
      factor("Odds", `${market.odds.sportsbook} ${market.odds.american > 0 ? "+" : ""}${market.odds.american}`),
      factor("Data freshness", `${freshMin} min old`),
    ],
    dataQuality,
    seasonStats: `${stats.season.average.toFixed(3)} over ${stats.season.games} G`,
    last5: `${stats.last5.average.toFixed(3)} over ${stats.last5.games} G`,
    last10: `${stats.last10.average.toFixed(3)} over ${stats.last10.games} G`,
    homeAwaySplit: `${side.isHome ? "Home" : "Away"} ${site.toFixed(3)}`,
    handednessMatchup: `${player.bats} vs ${opposingPitcher?.throws ?? "—"}`,
    dataFreshnessMinutes: freshMin,
    updatedAt: nowIso,
  }, {
    market,
    evidence,
    availability: clamp(availability, 0, 1),
    missingInputs,
    playerStatus: player.status,
    lineupStatus: game.lineupStatus,
    battingOrder: null,
  });
}

export function runModel(input: EngineInput): EngineOutput {
  const { games, players, statistics, markets, teamStatistics, nowIso } = input;
  const gameById = new Map(games.map((g) => [g.id, g]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const statsById = new Map(statistics.map((s) => [s.playerId, s]));
  const teamStatsById = new Map(teamStatistics.map((s) => [s.teamId, s]));

  const picks: Pick[] = [];

  for (const market of markets) {
    if (!hasRequiredMarketData(market)) continue;
    const game = gameById.get(market.gameId);
    if (!game || game.status === "FINAL" || game.status === "POSTPONED") continue;

    const pick = market.playerId
      ? (() => {
          const player = playerById.get(market.playerId ?? "");
          const stats = statsById.get(market.playerId ?? "");
          return player && stats ? createPlayerPick(market, game, player, stats, nowIso) : null;
        })()
      : createTeamPick(market, game, teamStatsById, nowIso);

    if (!pick) continue;
    if (!pick.teamName || !pick.opponentName || !pick.marketLabel || !pick.odds) continue;
    picks.push(pick);
  }

  const minEdgePct = input.minEdgePct ?? 0;
  const ranked = dedupePicks(picks)
    .filter((p) => (minEdgePct <= 0 ? true : (p.edgePct ?? -100) >= minEdgePct))
    .sort((a, b) => {
      const scoreDelta = b.rankScore - a.rankScore;
      if (Math.abs(scoreDelta) > 0.05) return scoreDelta;
      return (b.expectedRoi ?? -1) - (a.expectedRoi ?? -1);
    });

  const qualified = ranked.filter((p) => p.dataQuality !== "LOW");
  const combos = buildCombos(qualified, nowIso, input.minConfidence ?? 55);
  const bestBet = pickBestBet(ranked);

  return { picks: ranked, combos, bestBet };

}

/**
 * Single highest-conviction play of the day.
 * Requires a positive edge, non-LOW data quality and reasonably fresh inputs —
 * otherwise no best bet is claimed at all.
 */
function pickBestBet(picks: Pick[]): BestBet | null {
  const eligible = picks.filter(
    (p) =>
      (p.edgePct ?? -1) > 0 &&
      p.dataQuality !== "LOW" &&
      p.freshness !== "VERY_STALE" &&
      (p.expectedRoi ?? -1) > 0,
  );
  const top = eligible[0];
  if (!top) return null;
  return { pick: top, score: top.rankScore, rationale: rankRationale(top) };
}

function dedupePicks(picks: Pick[]): Pick[] {
  const bestByKey = new Map<string, Pick>();
  for (const pick of picks) {
    const key = `${pick.gameId}:${pick.teamId}:${pick.playerId ?? "team"}:${pick.marketType}:${pick.line ?? "ml"}`;
    const existing = bestByKey.get(key);
    if (!existing || pick.confidence > existing.confidence) bestByKey.set(key, pick);
  }
  return Array.from(bestByKey.values());
}

function compatibleWithCombo(legs: Pick[], candidate: Pick): boolean {
  if (legs.some((leg) => leg.gameId === candidate.gameId)) return false;
  if (legs.some((leg) => leg.teamId === candidate.opponentTeamId && leg.opponentTeamId === candidate.teamId)) {
    return false;
  }
  const familyCount = legs.filter((leg) => leg.marketType === candidate.marketType).length;
  if (familyCount >= 2) return false;
  return true;
}

function comboIdFor(risk: RiskCategory, legs: Pick[]): string {
  return `combo-${risk.toLowerCase()}-${legs.map((leg) => leg.marketId).join("-")}`.replace(/[^a-z0-9-]/gi, "-");
}

function buildCombos(pool: Pick[], nowIso: string, minConfidence: number): Combo[] {
  const eligible = pool.filter((p) => p.confidence >= minConfidence && p.odds && p.impliedProbability !== null);
  const combos: Combo[] = [];

  const recipes: {
    name: string;
    risk: RiskCategory;
    legs: number;
    sort: (a: Pick, b: Pick) => number;
    filter: (p: Pick) => boolean;
    reasoning: string;
  }[] = [
    {
      name: "Safe Board",
      risk: "SAFE",
      legs: 2,
      sort: (a, b) => b.probability - a.probability,
      filter: (p) => p.marketType === "MONEYLINE" && p.probability >= 0.56,
      reasoning: "Highest win-probability legs from the live moneyline board.",
    },
    {
      name: "Smart Balance",
      risk: "SMART",
      legs: 3,
      sort: (a, b) => b.confidence - a.confidence,
      filter: (p) => p.probability >= 0.49,
      reasoning: "Balances projected probability, market price, and data completeness.",
    },
    {
      name: "Value Spots",
      risk: "VALUE",
      legs: 3,
      sort: (a, b) => (b.edge ?? -1) - (a.edge ?? -1),
      filter: (p) => (p.edge ?? -1) > 0,
      reasoning: "Largest positive gap between model probability and current implied probability.",
    },
    {
      name: "Two-Leg Value",
      risk: "VALUE",
      legs: 2,
      sort: (a, b) => (b.edge ?? -1) - (a.edge ?? -1),
      filter: (p) => (p.edge ?? -1) > 0.005,
      reasoning: "Compact build around the top priced live edges.",
    },
    {
      name: "Aggressive Swing",
      risk: "AGGRESSIVE",
      legs: 4,
      sort: (a, b) => (b.odds?.american ?? -1000) - (a.odds?.american ?? -1000),
      filter: (p) => p.confidence >= Math.max(50, minConfidence - 10),
      reasoning: "Higher-risk live prices with wider payout variance.",
    },
    {
      name: "Extended Board",
      risk: "AGGRESSIVE",
      legs: 5,
      sort: (a, b) => b.confidence - a.confidence,
      filter: (p) => p.confidence >= Math.max(50, minConfidence - 10),
      reasoning: "Five-leg build using only correlation-checked live markets.",
    },
  ];

  const usedSignatures = new Set<string>();
  for (const recipe of recipes) {
    const candidates = eligible.filter(recipe.filter).sort(recipe.sort);
    const legs: Pick[] = [];

    for (const candidate of candidates) {
      if (!compatibleWithCombo(legs, candidate)) continue;
      legs.push(candidate);
      if (legs.length === recipe.legs) break;
    }

    if (legs.length < recipe.legs) continue;
    const signature = legs.map((leg) => leg.marketId).sort().join("|");
    if (usedSignatures.has(signature)) continue;
    usedSignatures.add(signature);

    const modelProbability = legs.reduce((acc, leg) => acc * leg.probability, 1);
    const decimal = legs.reduce((acc, leg) => acc * americanToDecimal(leg.odds?.american ?? -110), 1);
    const combined = decimalToAmerican(decimal);
    const impliedProbability = 1 / decimal;
    const avgConfidence = legs.reduce((acc, leg) => acc + leg.confidence, 0) / legs.length;
    const confidence = Math.round(clamp(avgConfidence - (legs.length - 2) * 3, 0, 100));
    const teams = legs.map((leg) => `${leg.teamAbbreviation} vs ${leg.opponentAbbreviation}`).join(", ");

    combos.push({
      id: comboIdFor(recipe.risk, legs),
      name: recipe.name,
      risk: recipe.risk,
      legs,
      combinedOdds: combined,
      modelProbability,
      impliedProbability,
      confidence,
      estimatedEdge: modelProbability - impliedProbability,
      reasoning: `${recipe.reasoning} Matchups: ${teams}. Higher-risk categories are labeled by volatility and leg count, not presented as safe.`,
      createdAt: nowIso,
    });
  }

  return combos.sort((a, b) => {
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return (b.estimatedEdge ?? -1) - (a.estimatedEdge ?? -1);
  });
}
