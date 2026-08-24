// Scoring engine — pure, data-in / data-out. No network, no UI.
//
// Pipeline (per available market):
//  1. validate data      2. player/team status   3. lineup status
//  4. starting pitcher   5. sample size          6. projection
//  7. probability        8. implied probability  9. edge
// 10. confidence        11. rank picks          12. build combinations

import { americanToDecimal, americanToImplied, decimalToAmerican } from "../odds";
import type {
  Combo,
  DataQuality,
  Game,
  Market,
  Pick,
  Player,
  PlayerStatistics,
  ProjectionFactor,
  RiskCategory,
} from "../types";

export interface EngineInput {
  games: Game[];
  players: Player[];
  statistics: PlayerStatistics[];
  markets: Market[];
  nowIso: string;
  minConfidence?: number;
}

export interface EngineOutput {
  picks: Pick[];
  combos: Combo[];
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

function qualityFrom(sampleSize: number, lineupOk: boolean, pitcherOk: boolean): DataQuality {
  let score = 0;
  if (sampleSize >= 200) score += 2;
  else if (sampleSize >= 60) score += 1;
  if (lineupOk) score += 1;
  if (pitcherOk) score += 1;
  if (score >= 3) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

function riskFor(probability: number, edge: number | null): RiskCategory {
  if (probability >= 0.68) return "SAFE";
  if ((edge ?? 0) >= 0.05) return "VALUE";
  if (probability >= 0.55) return "SMART";
  return "AGGRESSIVE";
}

export function runModel(input: EngineInput): EngineOutput {
  const { games, players, statistics, markets, nowIso } = input;
  const gameById = new Map(games.map((g) => [g.id, g]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const statsById = new Map(statistics.map((s) => [s.playerId, s]));

  const picks: Pick[] = [];

  for (const market of markets) {
    // 1. Validate data
    const game = gameById.get(market.gameId);
    if (!game || !market.playerId) continue;
    const player = playerById.get(market.playerId);
    const stats = statsById.get(market.playerId);
    if (!player || !stats) continue;

    // 2. Player status
    if (player.status === "OUT") continue;

    // 3/4. Lineup + starting pitcher availability
    const isHome = player.teamId === game.homeTeam.id;
    const opposingPitcher = isHome ? game.awayPitcher : game.homePitcher;
    const isPitcherProp = market.marketType === "STRIKEOUTS_OVER";
    const lineupOk = game.lineupStatus === "CONFIRMED" || isPitcherProp;
    const pitcherOk = isPitcherProp ? true : Boolean(opposingPitcher);

    // 5. Sample size
    const sampleSize = stats.sampleSize;

    // 6. Projection
    const recent = (stats.last5.average + stats.last10.average) / 2;
    const site = isHome ? stats.home.average : stats.away.average;
    const platoon =
      opposingPitcher?.throws === "L" ? stats.vsLeft.average : stats.vsRight.average;
    const opponentSplit = stats.opponent?.average ?? null;

    let projection = stats.season.average * 0.4 + recent * 0.25 + site * 0.15 + platoon * 0.2;
    if (opponentSplit !== null) projection = projection * 0.9 + opponentSplit * 0.1;

    // Park + weather nudges
    const wind = game.weather?.windMph ?? null;
    const windOut = game.weather?.windDirection?.startsWith("Out") ?? false;
    if (wind !== null && windOut) projection *= 1.02;
    if (wind !== null && !windOut && wind > 10) projection *= 0.99;

    // 7. Estimate probability of clearing the line
    let probability: number;
    if (isPitcherProp) {
      const line = market.line ?? 5.5;
      probability = clamp(0.5 + (projection - line) * 0.14, 0.2, 0.9);
    } else if (market.marketType === "TOTAL_BASES_OVER") {
      probability = clamp(projection * 1.55, 0.2, 0.88);
    } else {
      // Over 0.5 style: P(at least one) across ~4 opportunities
      probability = clamp(1 - Math.pow(1 - projection, 4), 0.2, 0.92);
    }
    if (player.status === "QUESTIONABLE") probability *= 0.94;

    // 8/9. Implied probability + edge
    const american = market.odds?.american ?? null;
    const implied = american === null ? null : americanToImplied(american);
    const edge = implied === null ? null : probability - implied;

    // 10. Confidence
    const dataQuality = qualityFrom(sampleSize, lineupOk, pitcherOk);
    const freshnessMin = Math.max(
      0,
      (Date.parse(nowIso) - Date.parse(market.updatedAt)) / 60000,
    );
    let confidence =
      probability * 70 +
      (dataQuality === "HIGH" ? 20 : dataQuality === "MEDIUM" ? 12 : 4) +
      clamp((edge ?? 0) * 120, -10, 10) -
      clamp(freshnessMin / 30, 0, 8);
    if (player.status === "QUESTIONABLE") confidence -= 8;
    confidence = Math.round(clamp(confidence, 0, 100));

    const reasoning: ProjectionFactor[] = [
      factor(
        "Season stats",
        `${stats.season.average} over ${stats.season.games} G`,
        stats.season.average >= projection ? "POSITIVE" : "NEUTRAL",
      ),
      factor("Recent performance (L5 / L10)", `${stats.last5.average} / ${stats.last10.average}`,
        recent >= stats.season.average ? "POSITIVE" : "NEGATIVE"),
      factor(
        "Starting pitcher matchup",
        opposingPitcher ? `${opposingPitcher.name} (${opposingPitcher.era ?? "—"} ERA)` : null,
      ),
      factor("Batter handedness", player.bats),
      factor("Pitcher handedness", opposingPitcher ? opposingPitcher.throws : null),
      factor("Home / away", isHome ? "Home" : "Away"),
      factor("Ballpark", game.venue),
      factor(
        "Weather",
        game.weather
          ? `${game.weather.temperatureF}°F, wind ${game.weather.windMph} mph ${game.weather.windDirection}`
          : null,
      ),
      factor(
        "Injury status",
        player.status,
        player.status === "ACTIVE" ? "POSITIVE" : "NEGATIVE",
      ),
      factor(
        "Lineup status",
        game.lineupStatus === "UNAVAILABLE" ? null : game.lineupStatus,
        game.lineupStatus === "CONFIRMED" ? "POSITIVE" : "NEUTRAL",
      ),
      factor("Sample size", `${sampleSize} plate appearances`, sampleSize >= 200 ? "POSITIVE" : "NEGATIVE"),
      factor("Data freshness", `${Math.round(freshnessMin)} min old`),
      factor("Market line", market.line !== null ? String(market.line) : null),
    ];

    picks.push({
      id: `pick-${market.id}`,
      marketId: market.id,
      gameId: game.id,
      selection: player.name,
      marketLabel: market.label,
      line: market.line,
      odds: market.odds,
      probability,
      impliedProbability: implied,
      edge,
      confidence,
      risk: riskFor(probability, edge),
      reasoning,
      dataQuality,
      updatedAt: nowIso,
    });
  }

  // 11. Rank picks — never recommend LOW data quality
  const qualified = picks
    .filter((p) => p.dataQuality !== "LOW")
    .sort((a, b) => b.confidence - a.confidence);

  const combos = buildCombos(qualified, gameById, nowIso, input.minConfidence ?? 55);

  return { picks: picks.sort((a, b) => b.confidence - a.confidence), combos };
}

// 12. Build combinations
function buildCombos(
  pool: Pick[],
  gameById: Map<string, Game>,
  nowIso: string,
  minConfidence: number,
): Combo[] {
  const eligible = pool.filter((p) => p.confidence >= minConfidence && p.odds);
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
      filter: (p) => p.probability >= 0.6 && p.dataQuality === "HIGH",
      reasoning: "Highest model probability legs with HIGH data quality only.",
    },
    {
      name: "Smart Balance",
      risk: "SMART",
      legs: 3,
      sort: (a, b) => b.confidence - a.confidence,
      filter: (p) => p.probability >= 0.5,
      reasoning: "Balances model probability against the offered price.",
    },
    {
      name: "Value Spots",
      risk: "VALUE",
      legs: 3,
      sort: (a, b) => (b.edge ?? 0) - (a.edge ?? 0),
      filter: (p) => (p.edge ?? 0) > 0,
      reasoning: "Largest positive gap between model and implied probability.",
    },
    {
      name: "Aggressive Swing",
      risk: "AGGRESSIVE",
      legs: 4,
      sort: (a, b) => (b.odds?.american ?? 0) - (a.odds?.american ?? 0),
      filter: () => true,
      reasoning: "Higher variance legs with a larger potential payout.",
    },
    {
      name: "Extended Board",
      risk: "AGGRESSIVE",
      legs: 5,
      sort: (a, b) => (b.edge ?? 0) - (a.edge ?? 0),
      filter: () => true,
      reasoning: "Five-leg build for maximum payout; correlation-checked legs only.",
    },
    {
      name: "Two-Leg Value",
      risk: "VALUE",
      legs: 2,
      sort: (a, b) => (b.edge ?? 0) - (a.edge ?? 0),
      filter: (p) => (p.edge ?? 0) > 0.01,
      reasoning: "Compact two-leg build around the top priced edges.",
    },
  ];

  for (const recipe of recipes) {
    const candidates = eligible.filter(recipe.filter).sort(recipe.sort);
    const legs: Pick[] = [];
    const usedGames = new Set<string>();
    const usedMarketTypes = new Map<string, number>();

    for (const c of candidates) {
      // Correlation control: one leg per game, limited repeats per market family.
      if (usedGames.has(c.gameId)) continue;
      const family = c.marketLabel.replace(/[\d.]+/g, "").trim();
      if ((usedMarketTypes.get(family) ?? 0) >= 2) continue;
      legs.push(c);
      usedGames.add(c.gameId);
      usedMarketTypes.set(family, (usedMarketTypes.get(family) ?? 0) + 1);
      if (legs.length === recipe.legs) break;
    }

    // If we cannot fill the recipe with qualifying picks, do NOT manufacture legs.
    if (legs.length < recipe.legs) continue;

    const modelProbability = legs.reduce((acc, l) => acc * l.probability, 1);
    const decimal = legs.reduce((acc, l) => acc * americanToDecimal(l.odds!.american), 1);
    const combined = decimalToAmerican(decimal);
    const impliedProbability = 1 / decimal;
    const confidence = Math.round(
      legs.reduce((acc, l) => acc + l.confidence, 0) / legs.length -
        (legs.length - 2) * 2,
    );

    combos.push({
      id: `combo-${recipe.risk.toLowerCase()}-${recipe.legs}`,
      name: recipe.name,
      risk: recipe.risk,
      legs,
      combinedOdds: combined,
      modelProbability,
      impliedProbability,
      confidence: clamp(confidence, 0, 100),
      estimatedEdge: modelProbability - impliedProbability,
      reasoning: `${recipe.reasoning} Games: ${legs
        .map((l) => {
          const g = gameById.get(l.gameId);
          return g ? `${g.awayTeam.abbreviation}@${g.homeTeam.abbreviation}` : l.gameId;
        })
        .join(", ")}.`,
      createdAt: nowIso,
    });
  }

  return combos.sort((a, b) => b.confidence - a.confidence);
}
