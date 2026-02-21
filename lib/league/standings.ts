import { prisma } from "@/lib/db/prisma";

export type StandingsRow = {
  teamId: string;
  city: string;
  name: string;
  abbrev: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  pct: number;
  gamesBack: number;
};

export async function getStandings(season: number): Promise<StandingsRow[]> {
  const [teams, playedGames] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ conference: "asc" }, { city: "asc" }],
      select: {
        id: true,
        city: true,
        name: true,
        abbrev: true,
        conference: true,
        division: true,
      },
    }),
    prisma.game.findMany({
      where: {
        season,
        isPlayed: true,
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
    }),
  ]);

  const recordMap = new Map<string, { wins: number; losses: number }>();

  for (const team of teams) {
    recordMap.set(team.id, { wins: 0, losses: 0 });
  }

  for (const game of playedGames) {
    const homeRecord = recordMap.get(game.homeTeamId);
    const awayRecord = recordMap.get(game.awayTeamId);

    if (!homeRecord || !awayRecord || game.homeScore === game.awayScore) {
      continue;
    }

    if (game.homeScore > game.awayScore) {
      homeRecord.wins += 1;
      awayRecord.losses += 1;
    } else {
      awayRecord.wins += 1;
      homeRecord.losses += 1;
    }
  }

  const rows = teams.map((team) => {
    const record = recordMap.get(team.id) ?? { wins: 0, losses: 0 };
    const gamesPlayed = record.wins + record.losses;
    return {
      teamId: team.id,
      city: team.city,
      name: team.name,
      abbrev: team.abbrev,
      conference: team.conference,
      division: team.division,
      wins: record.wins,
      losses: record.losses,
      pct: gamesPlayed > 0 ? record.wins / gamesPlayed : 0,
      gamesBack: 0,
    } satisfies StandingsRow;
  });

  const leaders = new Map<string, number>();
  for (const row of rows) {
    const current = leaders.get(row.conference) ?? -1;
    leaders.set(row.conference, Math.max(current, row.wins));
  }

  for (const row of rows) {
    const conferenceLeaderWins = leaders.get(row.conference) ?? row.wins;
    row.gamesBack = Math.max(0, (conferenceLeaderWins - row.wins) / 2);
  }

  return rows.sort((a, b) => {
    if (a.conference !== b.conference) {
      return a.conference.localeCompare(b.conference);
    }
    if (b.pct !== a.pct) {
      return b.pct - a.pct;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.city.localeCompare(b.city);
  });
}
