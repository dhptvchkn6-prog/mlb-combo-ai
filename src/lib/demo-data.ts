// DEMO DATA ONLY.
// Intentionally fictional: "Demo Player 1", "Demo Team A", etc.
// This must never be presented as live MLB information.

import type {
  Game,
  Market,
  Player,
  PlayerStatistics,
  Pitcher,
  Team,
  SplitLine,
  MarketType,
} from "./types";

/** Deterministic pseudo-random generator so SSR and client agree. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function split(avg: number, games: number): SplitLine {
  return { average: Number(avg.toFixed(3)), perGame: Number(avg.toFixed(2)), games };
}

export interface DemoDataset {
  teams: Team[];
  games: Game[];
  players: Player[];
  statistics: PlayerStatistics[];
  markets: Market[];
  generatedAt: string;
}

export function buildDemoDataset(nowIso: string): DemoDataset {
  const rng = makeRng(20260824);
  const teams: Team[] = LETTERS.map((l, i) => ({
    id: `demo-team-${l.toLowerCase()}`,
    name: `Demo Team ${l}`,
    abbreviation: `D${l}`,
    venue: `Demo Ballpark ${i + 1}`,
  }));

  const games: Game[] = [];
  const players: Player[] = [];
  const statistics: PlayerStatistics[] = [];
  const markets: Market[] = [];

  const date = nowIso.slice(0, 10);

  for (let g = 0; g < 6; g++) {
    const away = teams[g * 2]!;
    const home = teams[g * 2 + 1]!;
    const gameId = `demo-game-${g + 1}`;
    const hour = 13 + g;
    const lineupStatus = g % 3 === 0 ? "CONFIRMED" : g % 3 === 1 ? "PROJECTED" : "UNAVAILABLE";

    const mkPitcher = (teamId: string, n: number): Pitcher => ({
      id: `demo-pitcher-${gameId}-${n}`,
      name: `Demo Pitcher ${g * 2 + n}`,
      teamId,
      throws: rng() > 0.6 ? "L" : "R",
      status: "ACTIVE",
      era: Number((2.6 + rng() * 2.4).toFixed(2)),
      strikeoutsPer9: Number((6.5 + rng() * 4).toFixed(1)),
    });

    games.push({
      id: gameId,
      date,
      startTime: `${String(hour).padStart(2, "0")}:${g % 2 === 0 ? "05" : "40"}`,
      homeTeam: home,
      awayTeam: away,
      status: "SCHEDULED",
      homePitcher: g === 5 ? null : mkPitcher(home.id, 2),
      awayPitcher: mkPitcher(away.id, 1),
      venue: home.venue,
      weather:
        g % 4 === 3
          ? null
          : {
              temperatureF: Math.round(64 + rng() * 22),
              windMph: Math.round(3 + rng() * 12),
              windDirection: ["Out to LF", "In from CF", "L to R", "R to L"][g % 4]!,
              conditions: ["Clear", "Partly cloudy", "Overcast"][g % 3]!,
            },
      lineupStatus,
      dataUpdatedAt: nowIso,
    });

    // 4 hitters per game + 1 pitcher prop market
    for (let p = 0; p < 4; p++) {
      const team = p < 2 ? away : home;
      const playerId = `demo-player-${gameId}-${p + 1}`;
      const player: Player = {
        id: playerId,
        name: `Demo Player ${g * 4 + p + 1}`,
        teamId: team.id,
        position: ["OF", "1B", "SS", "C"][p]!,
        bats: rng() > 0.65 ? "L" : "R",
        status: g === 4 && p === 3 ? "QUESTIONABLE" : "ACTIVE",
      };
      players.push(player);

      const base = 0.24 + rng() * 0.11;
      const sampleSize = 40 + Math.floor(rng() * 380);
      statistics.push({
        playerId,
        season: split(base, Math.round(sampleSize / 4)),
        last5: split(base + (rng() - 0.4) * 0.09, 5),
        last10: split(base + (rng() - 0.45) * 0.07, 10),
        home: split(base + (rng() - 0.5) * 0.05, 30),
        away: split(base + (rng() - 0.5) * 0.05, 30),
        vsLeft: split(base + (rng() - 0.5) * 0.08, 25),
        vsRight: split(base + (rng() - 0.5) * 0.06, 55),
        opponent: rng() > 0.5 ? split(base + (rng() - 0.5) * 0.1, 8) : null,
        sampleSize,
        updatedAt: nowIso,
      });

      const marketTypes: MarketType[] = ["HITS_OVER", "TOTAL_BASES_OVER", "RUNS_RBI_OVER"];
      const mt = marketTypes[p % marketTypes.length]!;
      const line = mt === "TOTAL_BASES_OVER" ? 1.5 : 0.5;
      const american = [-160, -135, -115, 105, 125, 150, 180][Math.floor(rng() * 7)]!;
      markets.push({
        id: `demo-market-${gameId}-${p + 1}`,
        gameId,
        playerId,
        teamId: team.id,
        marketType: mt,
        label:
          mt === "HITS_OVER"
            ? `Over ${line} Hits`
            : mt === "TOTAL_BASES_OVER"
              ? `Over ${line} Total Bases`
              : `Over ${line} Runs + RBI`,
        line,
        odds:
          g === 3 && p === 0
            ? null // demonstrates "odds unavailable" handling
            : { american, sportsbook: "Demo Book", updatedAt: nowIso },
        sportsbook: "Demo Book",
        updatedAt: nowIso,
      });
    }

    const ap = games[g]!.awayPitcher;
    if (ap) {
      markets.push({
        id: `demo-market-${gameId}-k`,
        gameId,
        playerId: ap.id,
        teamId: ap.teamId,
        marketType: "STRIKEOUTS_OVER",
        label: "Over 5.5 Strikeouts",
        line: 5.5,
        odds: { american: [-130, -110, 110][g % 3]!, sportsbook: "Demo Book", updatedAt: nowIso },
        sportsbook: "Demo Book",
        updatedAt: nowIso,
      });
      statistics.push({
        playerId: ap.id,
        season: split(6.2 + rng() * 2, 22),
        last5: split(6.0 + rng() * 2.5, 5),
        last10: split(6.1 + rng() * 2, 10),
        home: split(6.3 + rng() * 1.5, 11),
        away: split(5.9 + rng() * 1.5, 11),
        vsLeft: split(6.0 + rng() * 1.5, 12),
        vsRight: split(6.4 + rng() * 1.5, 14),
        opponent: null,
        sampleSize: 22,
        updatedAt: nowIso,
      });
      players.push({
        id: ap.id,
        name: ap.name,
        teamId: ap.teamId,
        position: "SP",
        bats: ap.throws,
        status: ap.status,
      });
    }
  }

  return { teams, games, players, statistics, markets, generatedAt: nowIso };
}
