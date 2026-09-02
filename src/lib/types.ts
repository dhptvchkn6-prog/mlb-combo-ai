// Core domain models for Pro Baseball Combos.
// LIVE data only: schedules, odds, stats and injuries are sourced from connected APIs.

export type DataMode = "LIVE";
export type DataQuality = "HIGH" | "MEDIUM" | "LOW";
export type RiskCategory = "SAFE" | "SMART" | "VALUE" | "AGGRESSIVE";
export type Handedness = "L" | "R" | "S" | "UNKNOWN";
export type PlayerStatus = "ACTIVE" | "QUESTIONABLE" | "OUT" | "UNKNOWN";
export type GameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL" | "POSTPONED";
export type LineupStatus = "CONFIRMED" | "PROJECTED" | "UNAVAILABLE";
export type SelectionType = "PLAYER_PROP" | "TEAM_BET";

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  venue: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: string;
  bats: Handedness;
  status: PlayerStatus;
}

export interface Pitcher {
  id: string;
  name: string;
  teamId: string;
  throws: Handedness;
  status: PlayerStatus;
  era: number | null;
  strikeoutsPer9: number | null;
}

export interface Weather {
  temperatureF: number | null;
  windMph: number | null;
  windDirection: string | null;
  conditions: string | null;
}

export interface Lineup {
  gameId: string;
  teamId: string;
  status: LineupStatus;
  playerIds: string[];
}

export interface Game {
  id: string;
  date: string;
  startTime: string;
  homeTeam: Team;
  awayTeam: Team;
  status: GameStatus;
  homePitcher: Pitcher | null;
  awayPitcher: Pitcher | null;
  venue: string;
  weather: Weather | null;
  lineupStatus: LineupStatus;
  dataUpdatedAt: string;
}

export type MarketType =
  | "HITS_OVER"
  | "TOTAL_BASES_OVER"
  | "STRIKEOUTS_OVER"
  | "RUNS_RBI_OVER"
  | "TEAM_TOTAL_OVER"
  | "MONEYLINE"
  | "RUNLINE";

export interface Odds {
  american: number;
  sportsbook: string;
  updatedAt: string;
}

/** One sportsbook's price for a market. A market may carry many. */
export interface BookQuote {
  sportsbook: string;
  american: number;
  line: number | null;
  updatedAt: string;
}

export type MovementDirection = "TOWARD" | "AWAY" | "UNCHANGED" | "UNAVAILABLE";

export interface LineMovement {
  openingLine: number | null;
  currentLine: number | null;
  openingOdds: number | null;
  currentOdds: number | null;
  openedAt: string | null;
  updatedAt: string | null;
  direction: MovementDirection;
}

export interface Market {
  id: string;
  gameId: string;
  playerId: string | null;
  teamId: string | null;
  marketType: MarketType;
  label: string;
  line: number | null;
  /** Best available price across all quotes. */
  odds: Odds | null;
  /** Every sportsbook price currently supplied by the connected provider. */
  quotes: BookQuote[];
  sportsbook: string | null;
  updatedAt: string;
  movement: LineMovement | null;
}


export interface SplitLine {
  average: number;
  perGame: number;
  games: number;
}

export interface PlayerStatistics {
  playerId: string;
  season: SplitLine;
  last5: SplitLine;
  last10: SplitLine;
  home: SplitLine;
  away: SplitLine;
  vsLeft: SplitLine;
  vsRight: SplitLine;
  opponent: SplitLine | null;
  sampleSize: number;
  updatedAt: string;
}

export interface TeamStatistics {
  teamId: string;
  wins: number;
  losses: number;
  winPct: number;
  homeWinPct: number | null;
  awayWinPct: number | null;
  runsPerGame: number | null;
  runsAllowedPerGame: number | null;
  battingAverage: number | null;
  onBasePct: number | null;
  sluggingPct: number | null;
  era: number | null;
  bullpenEra: number | null;
  injuries: number;
  updatedAt: string;
}

export interface Projection {
  marketId: string;
  expectedValue: number;
  variance: number;
  factors: ProjectionFactor[];
}

export interface ProjectionFactor {
  label: string;
  value: string;
  available: boolean;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

export interface Pick {
  id: string;
  marketId: string;
  gameId: string;
  selectionType: SelectionType;
  playerId: string | null;
  playerName: string | null;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  opponentTeamId: string;
  opponentName: string;
  opponentAbbreviation: string;
  gameTime: string;
  venue: string;
  startingPitcher: string | null;
  opposingPitcher: string | null;
  selection: string;
  marketType: MarketType;
  marketLabel: string;
  line: number | null;
  odds: Odds | null;
  projection: number | null;
  projectionLabel: string;
  probability: number;
  impliedProbability: number | null;
  edge: number | null;
  confidence: number;
  risk: RiskCategory;
  reasoning: ProjectionFactor[];
  dataQuality: DataQuality;
  seasonStats: string;
  last5: string;
  last10: string;
  homeAwaySplit: string;
  handednessMatchup: string;
  dataFreshnessMinutes: number;
  updatedAt: string;
  // --- v2 analytics fields ---
  /** Decimal representation of the best available American price. */
  decimalOdds: number | null;
  /** Expected profit on a $100 stake at the model probability. */
  evPer100: number | null;
  /** evPer100 / 100 — expected return per unit staked. */
  expectedRoi: number | null;
  /** Probability required to break even at the current price. */
  breakEvenProbability: number | null;
  /** Edge expressed in percentage points (edge * 100). */
  edgePct: number | null;
  /** Deterministic 0-100 ranking score used to order picks. */
  rankScore: number;
  /** Every sportsbook price the provider currently supplies. */
  quotes: BookQuote[];
  bestSportsbook: string | null;
  movement: LineMovement | null;
  freshness: DataFreshness;
  playerStatus: PlayerStatus | null;
  lineupStatus: LineupStatus;
  battingOrder: number | null;
  missingInputs: string[];
  modelVersion: string;
}

export type CorrelationRisk = "LOW" | "MEDIUM" | "HIGH";

export interface Combo {
  id: string;
  name: string;
  risk: RiskCategory;
  legs: Pick[];
  combinedOdds: number | null;
  modelProbability: number;
  impliedProbability: number | null;
  confidence: number;
  estimatedEdge: number | null;
  reasoning: string;
  createdAt: string;
  // --- v2 analytics fields ---
  decimalOdds: number | null;
  evPer100: number | null;
  expectedRoi: number | null;
  correlationRisk: CorrelationRisk;
  dataQuality: DataQuality;
  rankScore: number;
  modelVersion: string;
}

export type DataFreshness = "FRESH" | "AGING" | "STALE" | "VERY_STALE";
export type SourceHealth = "CONNECTED" | "DEGRADED" | "UNAVAILABLE";

export interface DataSourceStatus {
  name: string;
  /** Retained for backwards compatibility with existing UI. */
  connected: boolean;
  status: SourceHealth;
  lastSuccessAt: string | null;
  ageMinutes: number | null;
  records: number;
  error: string | null;
}

export interface DataUpdate {
  mode: DataMode;
  liveConnected: boolean;
  lastUpdatedAt: string;
  sources: DataSourceStatus[];
  message: string;
  modelVersion: string;
}

export interface BoardPayload {
  update: DataUpdate;
  games: Game[];
  players: Player[];
  statistics: PlayerStatistics[];
  teamStatistics: TeamStatistics[];
  markets: Market[];
  picks: Pick[];
  combos: Combo[];
  bestBet: BestBet | null;
}

export interface BestBet {
  pick: Pick;
  score: number;
  rationale: string[];
}

export type RiskPreference = "SAFE" | "BALANCED" | "AGGRESSIVE";
export type RefreshInterval = "MANUAL" | "5" | "15" | "30";

export interface Settings {
  riskPreference: RiskPreference;
  minConfidence: number;
  minEdgePct: number;
  preferredLegs: 2 | 3 | 4 | 5;
  sportsbook: string;
  refreshInterval: RefreshInterval;
  dataMode: DataMode;
  unitSize: number;
  freshnessToleranceMinutes: number;
}

// ---- Prediction tracking ----

export type GradeResult = "WIN" | "LOSS" | "PUSH" | "VOID" | "PENDING";

export interface TrackedPrediction {
  id: string;
  predictionId: string;
  marketId: string;
  gameId: string;
  gameDate: string;
  selectionType: SelectionType;
  playerId: string | null;
  subject: string;
  opponent: string;
  marketType: MarketType;
  marketLabel: string;
  line: number | null;
  american: number;
  sportsbook: string;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  evPer100: number;
  confidence: number;
  risk: RiskCategory;
  dataQuality: DataQuality;
  modelVersion: string;
  createdAt: string;
  result: GradeResult;
  actualValue: number | null;
  gradedAt: string | null;
  profitUnits: number | null;
}

export interface PerformanceBucket {
  label: string;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  winRate: number | null;
  units: number;
  roi: number | null;
  averageEdge: number | null;
  averageConfidence: number | null;
}

export interface PerformanceSummary {
  overall: PerformanceBucket;
  byMarket: PerformanceBucket[];
  byConfidence: PerformanceBucket[];
  byRisk: PerformanceBucket[];
  byModelVersion: PerformanceBucket[];
  calibration: {
    bucket: string;
    predicted: number | null;
    actual: number | null;
    samples: number;
  }[];
  brierScore: number | null;
  gradedCount: number;
}

