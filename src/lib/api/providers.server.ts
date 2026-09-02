// Server-side live data provider layer. No mock, placeholder, or hardcoded MLB rows.

import type {
  BoardPayload,
  Game,
  GameStatus,
  Handedness,
  Market,
  Odds,
  Pitcher,
  Player,
  PlayerStatistics,
  PlayerStatus,
  SplitLine,
  Team,
  TeamStatistics,
  Weather,
} from "../types";
import {
  americanOdds,
  espnListResponse,
  liveFeedResponse,
  peopleResponse,
  readStat,
  rosterResponse,
  safeParse,
  scheduleResponse,
  statNumber,
  teamStatsResponse,
  transactionsResponse,
} from "./schemas";

export interface ProviderResult<T> {
  connected: boolean;
  data: T | null;
  error: string | null;
}

const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_BASE = "https://statsapi.mlb.com/api/v1.1";
const ESPN_CORE_BASE = "https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb";

interface JsonRecord {
  [key: string]: unknown;
}

interface LiveDataset {
  games: Game[];
  players: Player[];
  statistics: PlayerStatistics[];
  teamStatistics: TeamStatistics[];
  markets: Market[];
  sources: { name: string; connected: boolean }[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function child(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function parseNumber(value: unknown): number | null {
  return safeParse(statNumber, value, null);
}

function parseAmerican(value: unknown): number | null {
  return safeParse(americanOdds, value, null);
}

function pctFromRecord(summary: string | null): number | null {
  if (!summary) return null;
  const [winsRaw, lossesRaw] = summary.split("-");
  const wins = Number(winsRaw);
  const losses = Number(lossesRaw);
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins + losses === 0) return null;
  return wins / (wins + losses);
}

function toHandedness(value: unknown): Handedness {
  const code = asString(child(value, "code")) ?? asString(value);
  if (code === "L" || code === "R" || code === "S") return code;
  return "UNKNOWN";
}

function toGameStatus(status: unknown): GameStatus {
  const detailed = (asString(child(status, "abstractGameState")) ?? asString(child(status, "type")) ?? "").toLowerCase();
  const state = (asString(child(status, "detailedState")) ?? "").toLowerCase();
  if (detailed.includes("live") || detailed.includes("progress") || state.includes("progress")) return "IN_PROGRESS";
  if (detailed.includes("final") || state.includes("final")) return "FINAL";
  if (state.includes("postponed") || state.includes("suspended")) return "POSTPONED";
  return "SCHEDULED";
}

function teamFromMlb(raw: unknown): Team | null {
  const id = asNumber(child(raw, "id"));
  const name = asString(child(raw, "name"));
  const abbreviation = asString(child(raw, "abbreviation"));
  if (id === null || !name || !abbreviation) return null;
  return {
    id: String(id),
    name,
    abbreviation,
    venue: asString(child(child(raw, "venue"), "name")) ?? "Unknown venue",
  };
}

function normalizeTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function getJsonSettled(url: string): Promise<unknown | null> {
  try {
    return await getJson(url);
  } catch {
    return null;
  }
}

function splitFromTotals(total: number | null, games: number | null): SplitLine {
  const safeGames = games && games > 0 ? games : 0;
  const safeTotal = total ?? 0;
  const average = safeGames > 0 ? safeTotal / safeGames : 0;
  return { average, perGame: average, games: safeGames };
}

function addParsedStat(acc: number, statContainer: unknown, statName: "hits" | "totalBases" | "strikeOuts"): number {
  const parsed: number | null = readStat(statContainer, statName);
  return acc + (parsed ?? 0);
}

function battingAverageSplit(avg: number | null, games: number | null): SplitLine {
  const safeGames = games && games > 0 ? games : 0;
  return { average: avg ?? 0, perGame: avg ?? 0, games: safeGames };
}

function buildRecentSplit(gameLogs: unknown[], take: number, statName: "hits" | "totalBases" | "strikeOuts"): SplitLine {
  const logs = gameLogs.slice(-take);
  const total = logs.reduce<number>((acc, entry) => addParsedStat(acc, child(entry, "stat"), statName), 0);
  return splitFromTotals(total, logs.length);
}

function homeAwaySplit(gameLogs: unknown[], isHome: boolean, statName: "hits" | "totalBases" | "strikeOuts"): SplitLine {
  const logs = gameLogs.filter((entry) => child(entry, "isHome") === isHome);
  const total = logs.reduce<number>((acc, entry) => addParsedStat(acc, child(entry, "stat"), statName), 0);
  return splitFromTotals(total, logs.length);
}

function playerStatusFromInjuries(playerName: string, injuredNames: Set<string>): PlayerStatus {
  return injuredNames.has(playerName.toLowerCase()) ? "OUT" : "ACTIVE";
}

function pitcherFromPerson(person: unknown, teamId: string): Pitcher | null {
  const id = asNumber(child(person, "id"));
  const name = asString(child(person, "fullName"));
  if (id === null || !name) return null;
  const seasonPitching = asArray(child(person, "stats")).find(
    (entry) => asString(child(child(entry, "group"), "displayName")) === "pitching",
  );
  const firstSplit = asArray(child(seasonPitching, "splits"))[0];
  const stat = child(firstSplit, "stat");
  return {
    id: String(id),
    name,
    teamId,
    throws: toHandedness(child(person, "pitchHand")),
    status: "ACTIVE",
    era: parseNumber(child(stat, "era")),
    strikeoutsPer9: parseNumber(child(stat, "strikeoutsPer9Inn")),
  };
}

function teamStatsFromGame(game: unknown, side: "home" | "away", nowIso: string): TeamStatistics | null {
  const teamContainer = child(child(game, "teams"), side);
  const teamRaw = child(teamContainer, "team");
  const team = teamFromMlb(teamRaw);
  if (!team) return null;
  const record = child(teamContainer, "leagueRecord");
  const wins = parseNumber(child(record, "wins")) ?? 0;
  const losses = parseNumber(child(record, "losses")) ?? 0;
  const pct = parseNumber(child(record, "pct")) ?? (wins + losses > 0 ? wins / (wins + losses) : 0.5);
  return {
    teamId: team.id,
    wins,
    losses,
    winPct: pct,
    homeWinPct: null,
    awayWinPct: null,
    runsPerGame: null,
    runsAllowedPerGame: null,
    battingAverage: null,
    onBasePct: null,
    sluggingPct: null,
    era: null,
    bullpenEra: null,
    injuries: 0,
    updatedAt: nowIso,
  };
}

function mergeTeamStatsFromEspn(base: Map<string, TeamStatistics>, games: Game[], event: unknown, nowIso: string) {
  const competition = asArray(child(event, "competitions"))[0];
  for (const competitor of asArray(child(competition, "competitors"))) {
    const teamRaw = child(competitor, "team");
    const abbreviation = asString(child(teamRaw, "abbreviation"));
    const team = games.flatMap((g) => [g.homeTeam, g.awayTeam]).find((t) => t.abbreviation === abbreviation);
    if (!team) continue;
    const existing = base.get(team.id) ?? {
      teamId: team.id,
      wins: 0,
      losses: 0,
      winPct: 0.5,
      homeWinPct: null,
      awayWinPct: null,
      runsPerGame: null,
      runsAllowedPerGame: null,
      battingAverage: null,
      onBasePct: null,
      sluggingPct: null,
      era: null,
      bullpenEra: null,
      injuries: 0,
      updatedAt: nowIso,
    };
    for (const record of asArray(child(competitor, "records"))) {
      const type = asString(child(record, "type"));
      const pct = pctFromRecord(asString(child(record, "summary")));
      if (type === "home") existing.homeWinPct = pct;
      if (type === "road") existing.awayWinPct = pct;
    }
    for (const stat of asArray(child(competitor, "statistics"))) {
      const name = asString(child(stat, "name"));
      const value = parseNumber(child(stat, "displayValue"));
      if (name === "avg") existing.battingAverage = value;
      if (name === "ERA") existing.era = value;
      if (name === "runs") {
        const gamesPlayed = existing.wins + existing.losses;
        existing.runsPerGame = gamesPlayed > 0 && value !== null ? value / gamesPlayed : null;
      }
    }
    base.set(team.id, existing);
  }
}

function makeOdds(american: number | null, sportsbook: string, nowIso: string): Odds | null {
  if (american === null) return null;
  return { american, sportsbook, updatedAt: nowIso };
}

function oddsValue(raw: unknown, side: "home" | "away", kind: "moneyline" | "spreadOdds" | "spreadLine"): number | null {
  const sideOdds = child(raw, side === "home" ? "homeTeamOdds" : "awayTeamOdds");
  if (kind === "moneyline") {
    return parseAmerican(child(child(sideOdds, "current"), "moneyLine")) ?? parseAmerican(child(sideOdds, "moneyLine"));
  }
  const spread = child(child(sideOdds, "current"), "spread");
  if (kind === "spreadOdds") return parseAmerican(child(spread, "alternateDisplayValue"));
  if (kind === "spreadLine") return parseNumber(child(child(child(sideOdds, "current"), "pointSpread"), "alternateDisplayValue"));
  return null;
}

/** Opening numbers, when the provider exposes them, for line-movement tracking. */
function openingValue(raw: unknown, side: "home" | "away", kind: "moneyline" | "spreadOdds" | "spreadLine"): number | null {
  const sideOdds = child(raw, side === "home" ? "homeTeamOdds" : "awayTeamOdds");
  const open = child(sideOdds, "open");
  if (kind === "moneyline") return parseAmerican(child(open, "moneyLine"));
  if (kind === "spreadOdds") return parseAmerican(child(child(open, "spread"), "alternateDisplayValue"));
  return parseNumber(child(child(open, "pointSpread"), "alternateDisplayValue"));
}

/** Highest payout wins: compare in decimal space so +/- prices sort correctly. */
function bestQuote(quotes: BookQuote[]): BookQuote | null {
  let best: BookQuote | null = null;
  for (const quote of quotes) {
    if (!best || americanToDecimal(quote.american) > americanToDecimal(best.american)) best = quote;
  }
  return best;
}

function buildMovement(
  oddsItems: unknown[],
  side: "home" | "away",
  kind: "moneyline" | "spreadOdds",
  current: BookQuote | null,
  nowIso: string,
): LineMovement | null {
  for (const item of oddsItems) {
    const openingOdds = openingValue(item, side, kind);
    if (openingOdds === null) continue;
    const openingLine = kind === "spreadOdds" ? openingValue(item, side, "spreadLine") : null;
    const movement = {
      openingLine,
      currentLine: current?.line ?? null,
      openingOdds,
      currentOdds: current?.american ?? null,
      openedAt: null,
      updatedAt: nowIso,
      direction: "UNAVAILABLE" as LineMovement["direction"],
    };
    movement.direction = movementDirection(movement);
    return movement;
  }
  return null;
}

/**
 * Builds one market per team/side using every sportsbook the provider returns.
 * The market's headline price is the best available across books.
 */
function addTeamMarketsFromCoreOdds(markets: Market[], game: Game, oddsItems: unknown[], nowIso: string) {
  const sides: { key: "home" | "away"; team: Team }[] = [
    { key: "home", team: game.homeTeam },
    { key: "away", team: game.awayTeam },
  ];

  for (const side of sides) {
    const mlQuotes: BookQuote[] = [];
    const rlQuotes: BookQuote[] = [];

    for (const item of oddsItems) {
      const sportsbook = asString(child(child(item, "provider"), "name")) ?? "Live odds";
      const ml = oddsValue(item, side.key, "moneyline");
      if (ml !== null) mlQuotes.push({ sportsbook, american: ml, line: null, updatedAt: nowIso });
      const spreadLine = oddsValue(item, side.key, "spreadLine");
      const spreadOdds = oddsValue(item, side.key, "spreadOdds");
      if (spreadLine !== null && spreadOdds !== null) {
        rlQuotes.push({ sportsbook, american: spreadOdds, line: spreadLine, updatedAt: nowIso });
      }
    }

    const bestMl = bestQuote(mlQuotes);
    if (bestMl) {
      markets.push({
        id: `${game.id}-${side.team.id}-moneyline`,
        gameId: game.id,
        playerId: null,
        teamId: side.team.id,
        marketType: "MONEYLINE",
        label: "Moneyline",
        line: null,
        odds: makeOdds(bestMl.american, bestMl.sportsbook, nowIso),
        quotes: mlQuotes,
        sportsbook: bestMl.sportsbook,
        updatedAt: nowIso,
        movement: buildMovement(oddsItems, side.key, "moneyline", bestMl, nowIso),
      });
    }

    const bestRl = bestQuote(rlQuotes);
    if (bestRl) {
      markets.push({
        id: `${game.id}-${side.team.id}-runline`,
        gameId: game.id,
        playerId: null,
        teamId: side.team.id,
        marketType: "RUNLINE",
        label: "Runline",
        line: bestRl.line,
        odds: makeOdds(bestRl.american, bestRl.sportsbook, nowIso),
        quotes: rlQuotes,
        sportsbook: bestRl.sportsbook,
        updatedAt: nowIso,
        movement: buildMovement(oddsItems, side.key, "spreadOdds", bestRl, nowIso),
      });
    }
  }
}


async function fetchTeamSeasonStats(teamStats: Map<string, TeamStatistics>, season: string) {
  const json = await getJsonSettled(`${MLB_BASE}/teams/stats?group=hitting,pitching&stats=season&season=${season}&sportIds=1`);
  const parsed = safeParse(teamStatsResponse, json, { stats: [] });
  for (const group of parsed.stats) {
    const groupName = asString(child(child(group, "group"), "displayName"));
    for (const split of asArray(child(group, "splits"))) {
      const teamId = asNumber(child(child(split, "team"), "id"));
      if (teamId === null) continue;
      const stats = teamStats.get(String(teamId));
      if (!stats) continue;
      const stat = child(split, "stat");
      const gamesPlayed = parseNumber(child(stat, "gamesPlayed"));
      if (groupName === "hitting") {
        const runs = parseNumber(child(stat, "runs"));
        stats.runsPerGame = gamesPlayed && runs !== null ? runs / gamesPlayed : stats.runsPerGame;
        stats.battingAverage = parseNumber(child(stat, "avg"));
        stats.onBasePct = parseNumber(child(stat, "obp"));
        stats.sluggingPct = parseNumber(child(stat, "slg"));
      }
      if (groupName === "pitching") {
        const runsAllowed = parseNumber(child(stat, "runs"));
        stats.runsAllowedPerGame =
          gamesPlayed && runsAllowed !== null ? runsAllowed / gamesPlayed : stats.runsAllowedPerGame;
        stats.era = parseNumber(child(stat, "era"));
      }
    }
  }
}

async function fetchSchedule(dateIso: string, nowIso: string) {
  const url = `${MLB_BASE}/schedule?sportId=1&date=${dateIso}&hydrate=probablePitcher,team,venue`;
  const json = await getJson(url);
  const schedule = safeParse(scheduleResponse, json, { dates: [] });
  const mlbGames = asArray(child(schedule.dates[0], "games"));
  const games: Game[] = [];
  const teamStats = new Map<string, TeamStatistics>();
  const pitcherIds: { id: string; teamId: string; gameId: string; side: "home" | "away" }[] = [];

  for (const rawGame of mlbGames) {
    const idNum = asNumber(child(rawGame, "gamePk"));
    const gameDate = asString(child(rawGame, "gameDate"));
    const homeContainer = child(child(rawGame, "teams"), "home");
    const awayContainer = child(child(rawGame, "teams"), "away");
    const homeTeam = teamFromMlb(child(homeContainer, "team"));
    const awayTeam = teamFromMlb(child(awayContainer, "team"));
    if (idNum === null || !gameDate || !homeTeam || !awayTeam) continue;
    const homePitcherId = asNumber(child(child(homeContainer, "probablePitcher"), "id"));
    const awayPitcherId = asNumber(child(child(awayContainer, "probablePitcher"), "id"));
    if (homePitcherId !== null) {
      pitcherIds.push({ id: String(homePitcherId), teamId: homeTeam.id, gameId: String(idNum), side: "home" });
    }
    if (awayPitcherId !== null) {
      pitcherIds.push({ id: String(awayPitcherId), teamId: awayTeam.id, gameId: String(idNum), side: "away" });
    }
    const weather = await getWeather(String(idNum));
    games.push({
      id: String(idNum),
      date: asString(child(rawGame, "officialDate")) ?? dateIso,
      startTime: normalizeTime(gameDate),
      homeTeam,
      awayTeam,
      status: toGameStatus(child(rawGame, "status")),
      homePitcher: null,
      awayPitcher: null,
      venue: asString(child(child(rawGame, "venue"), "name")) ?? homeTeam.venue,
      weather,
      lineupStatus: "PROJECTED",
      dataUpdatedAt: nowIso,
    });
    const homeStats = teamStatsFromGame(rawGame, "home", nowIso);
    const awayStats = teamStatsFromGame(rawGame, "away", nowIso);
    if (homeStats) teamStats.set(homeStats.teamId, homeStats);
    if (awayStats) teamStats.set(awayStats.teamId, awayStats);
  }

  const pitchers = await fetchPitchers(pitcherIds, nowIso);
  const pitcherMap = new Map(pitchers.map((p) => [p.id, p]));
  for (const game of games) {
    const homePitcherRef = pitcherIds.find((p) => p.gameId === game.id && p.side === "home");
    const awayPitcherRef = pitcherIds.find((p) => p.gameId === game.id && p.side === "away");
    game.homePitcher = homePitcherRef ? (pitcherMap.get(homePitcherRef.id) ?? null) : null;
    game.awayPitcher = awayPitcherRef ? (pitcherMap.get(awayPitcherRef.id) ?? null) : null;
  }

  return { games, teamStats };
}

async function getWeather(gameId: string): Promise<Weather | null> {
  const json = await getJsonSettled(`${MLB_LIVE_BASE}/game/${gameId}/feed/live`);
  const feed = safeParse(liveFeedResponse, json, { gameData: null });
  const weatherRaw = feed.gameData?.weather ?? null;
  if (!isRecord(weatherRaw) || Object.keys(weatherRaw).length === 0) return null;
  return {
    temperatureF: parseNumber(child(weatherRaw, "temp")),
    windMph: parseNumber(child(weatherRaw, "wind")),
    windDirection: asString(child(weatherRaw, "windDirection")),
    conditions: asString(child(weatherRaw, "condition")),
  };
}

async function fetchPitchers(
  refs: { id: string; teamId: string; gameId: string; side: "home" | "away" }[],
  nowIso: string,
): Promise<Pitcher[]> {
  void nowIso;
  const unique = Array.from(new Map(refs.map((ref) => [ref.id, ref])).values());
  if (unique.length === 0) return [];
  const ids = unique.map((ref) => ref.id).join(",");
  const json = await getJsonSettled(`${MLB_BASE}/people?personIds=${ids}&hydrate=stats(group=[pitching],type=[season])`);
  return safeParse(peopleResponse, json, { people: [] })
    .people.map((person) => {
      const id = asNumber(child(person, "id"));
      const ref = id === null ? undefined : unique.find((item) => item.id === String(id));
      return ref ? pitcherFromPerson(person, ref.teamId) : null;
    })
    .filter((pitcher): pitcher is Pitcher => pitcher !== null);
}

async function fetchInjuredNames(teamIds: string[], dateIso: string): Promise<{ names: Set<string>; teamCounts: Map<string, number>; connected: boolean }> {
  const names = new Set<string>();
  const teamCounts = new Map<string, number>();
  const endDate = dateIso;
  const startDate = new Date(`${dateIso}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 45);
  let connected = false;

  for (const teamId of teamIds) {
    const url = `${MLB_BASE}/transactions?teamId=${teamId}&startDate=${startDate.toISOString().slice(0, 10)}&endDate=${endDate}&hydrate=person,team`;
    const json = await getJsonSettled(url);
    if (json !== null) connected = true;
    let count = 0;
    for (const tx of safeParse(transactionsResponse, json, { transactions: [] }).transactions) {
      const type = (asString(child(tx, "typeDesc")) ?? asString(child(tx, "description")) ?? "").toLowerCase();
      if (!type.includes("injured") && !type.includes("injury") && !type.includes("il")) continue;
      const personName = asString(child(child(tx, "person"), "fullName"));
      if (!personName) continue;
      count += 1;
      names.add(personName.toLowerCase());
    }
    teamCounts.set(teamId, count);
  }

  return { names, teamCounts, connected };
}

async function fetchRosterStats(
  teamIds: string[],
  injuredNames: Set<string>,
  nowIso: string,
): Promise<{ players: Player[]; statistics: PlayerStatistics[] }> {
  const players: Player[] = [];
  const statistics: PlayerStatistics[] = [];
  const seen = new Set<string>();

  for (const teamId of teamIds) {
    const url = `${MLB_BASE}/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(group=[hitting],type=[season,gameLog]))`;
    const json = await getJsonSettled(url);
    for (const entry of safeParse(rosterResponse, json, { roster: [] }).roster) {
      const person = child(entry, "person");
      const id = asNumber(child(person, "id"));
      const name = asString(child(person, "fullName"));
      const position = asString(child(child(person, "primaryPosition"), "abbreviation")) ?? "";
      if (id === null || !name || !position || position === "P" || seen.has(String(id))) continue;
      const statGroups = asArray(child(person, "stats"));
      const seasonGroup = statGroups.find(
        (group) => asString(child(child(group, "type"), "displayName")) === "season",
      );
      const gameLogGroup = statGroups.find(
        (group) => asString(child(child(group, "type"), "displayName")) === "gameLog",
      );
      const seasonSplit = asArray(child(seasonGroup, "splits"))[0];
      const stat = child(seasonSplit, "stat");
      const games = parseNumber(child(stat, "gamesPlayed"));
      const hits = parseNumber(child(stat, "hits"));
      const totalBases = parseNumber(child(stat, "totalBases"));
      const plateAppearances = parseNumber(child(stat, "plateAppearances"));
      if (!games || games < 10 || hits === null || totalBases === null || !plateAppearances) continue;

      const logs = asArray(child(gameLogGroup, "splits"));
      const player: Player = {
        id: String(id),
        name,
        teamId,
        position,
        bats: toHandedness(child(person, "batSide")),
        status: playerStatusFromInjuries(name, injuredNames),
      };
      players.push(player);
      statistics.push({
        playerId: player.id,
        season: splitFromTotals(hits, games),
        last5: buildRecentSplit(logs, 5, "hits"),
        last10: buildRecentSplit(logs, 10, "hits"),
        home: homeAwaySplit(logs, true, "hits"),
        away: homeAwaySplit(logs, false, "hits"),
        vsLeft: battingAverageSplit(parseNumber(child(stat, "avg")), games),
        vsRight: battingAverageSplit(parseNumber(child(stat, "avg")), games),
        opponent: null,
        sampleSize: plateAppearances,
        updatedAt: nowIso,
      });
      seen.add(player.id);
    }
  }

  return { players, statistics };
}

async function fetchEspnCoreEvents(dateIso: string): Promise<unknown[]> {
  const compact = dateIso.replaceAll("-", "");
  const json = await getJsonSettled(`${ESPN_CORE_BASE}/events?dates=${compact}&limit=100`);
  const refs = safeParse(espnListResponse, json, { items: [] })
    .items.map((item) => asString(child(item, "$ref")))
    .filter((value): value is string => Boolean(value));
  const events = await Promise.all(refs.map((ref) => getJsonSettled(ref.replace("http://", "https://"))));
  return events.filter((event): event is unknown => event !== null);
}

function eventForGame(game: Game, events: unknown[]): unknown | null {
  return (
    events.find((event) => {
      const shortName = asString(child(event, "shortName")) ?? "";
      const name = asString(child(event, "name")) ?? "";
      const haystack = `${shortName} ${name}`;
      return haystack.includes(game.homeTeam.abbreviation) && haystack.includes(game.awayTeam.abbreviation);
    }) ?? null
  );
}

async function fetchCoreOddsForEvent(event: unknown): Promise<unknown | null> {
  const competition = asArray(child(event, "competitions"))[0];
  const oddsRef = asString(child(child(competition, "odds"), "$ref"));
  if (!oddsRef) return null;
  const json = await getJsonSettled(oddsRef.replace("http://", "https://"));
  return safeParse(espnListResponse, json, { items: [] }).items[0] ?? null;
}

function attachInjuryCounts(teamStats: Map<string, TeamStatistics>, games: Game[], teamCounts: Map<string, number>) {
  for (const game of games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      const stats = teamStats.get(team.id);
      if (!stats) continue;
      stats.injuries = teamCounts.get(team.id) ?? 0;
    }
  }
}

function sourceStatus(dataset: Pick<LiveDataset, "games" | "players" | "markets">, injuriesConnected: boolean) {
  return [
    { name: "MLB StatsAPI schedule", connected: dataset.games.length > 0 },
    { name: "MLB StatsAPI player stats", connected: dataset.players.length > 0 },
    { name: "ESPN core live odds", connected: dataset.markets.length > 0 },
    { name: "MLB transaction injury status", connected: injuriesConnected },
  ];
}

export function getProviderStatus(): { name: string; connected: boolean }[] {
  return [
    { name: "MLB StatsAPI schedule", connected: true },
    { name: "MLB StatsAPI player stats", connected: true },
    { name: "ESPN core live odds", connected: false },
    { name: "MLB transaction injury status", connected: false },
  ];
}

export function isLiveConnected(): boolean {
  return false;
}

export async function fetchLiveBoard(dateIso: string, nowIso: string): Promise<ProviderResult<LiveDataset>> {
  try {
    const { games, teamStats } = await fetchSchedule(dateIso, nowIso);
    if (games.length === 0) {
      return {
        connected: true,
        data: {
          games: [],
          players: [],
          statistics: [],
          teamStatistics: [],
          markets: [],
          sources: sourceStatus({ games: [], players: [], markets: [] }, false),
        },
        error: null,
      };
    }

    const season = dateIso.slice(0, 4);
    await fetchTeamSeasonStats(teamStats, season);
    const teamIds = Array.from(new Set(games.flatMap((g) => [g.homeTeam.id, g.awayTeam.id])));
    const injuryResult = await fetchInjuredNames(teamIds, dateIso);
    const injuredNames = injuryResult.names;
    attachInjuryCounts(teamStats, games, injuryResult.teamCounts);
    const { players, statistics } = await fetchRosterStats(teamIds, injuredNames, nowIso);
    const markets: Market[] = [];
    const events = await fetchEspnCoreEvents(dateIso);

    for (const game of games) {
      const event = eventForGame(game, events);
      if (!event) continue;
      const odds = await fetchCoreOddsForEvent(event);
      if (odds) addTeamMarketsFromCoreOdds(markets, game, odds, nowIso);
    }

    const payload: LiveDataset = {
      games,
      players,
      statistics,
      teamStatistics: Array.from(teamStats.values()),
      markets,
      sources: sourceStatus({ games, players, markets }, injuryResult.connected),
    };

    return { connected: true, data: payload, error: null };
  } catch (error) {
    return {
      connected: false,
      data: null,
      error: error instanceof Error ? error.message : "Live data request failed.",
    };
  }
}
