import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Focus = "Inside" | "3PT" | "Balanced";

type SeedPlayer = {
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  age: number;
  ovr: number;
  salary: number;
  imgId?: string;
};

type SeedTeam = {
  team: string;
  city: string;
  abbrev: string;
  conference: "East" | "West";
  division: string;
  pace: number;
  focus: Focus;
  players: SeedPlayer[];
};

const prisma = new PrismaClient();
const CURRENT_SEASON = 2026;
const MIN_ROSTER_SIZE = 8;
const GAME_DAYS = 170;
const GAMES_PER_DAY = 7;

const positionHeights: Record<SeedPlayer["position"], number> = {
  PG: 75,
  SG: 77,
  SF: 80,
  PF: 82,
  C: 84,
};

const positionProfiles: Record<
  SeedPlayer["position"],
  { offense: number; defense: number; playmaking: number; rebounding: number; tendency: number }
> = {
  PG: { offense: 2, defense: -1, playmaking: 8, rebounding: -6, tendency: 7 },
  SG: { offense: 4, defense: 0, playmaking: 2, rebounding: -4, tendency: 8 },
  SF: { offense: 2, defense: 2, playmaking: 1, rebounding: -1, tendency: 3 },
  PF: { offense: 0, defense: 2, playmaking: -2, rebounding: 4, tendency: -2 },
  C: { offense: 1, defense: 3, playmaking: -5, rebounding: 7, tendency: -6 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const random = rng(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.join(" ") };
}

function buildBenchPlayer(team: SeedTeam, index: number): SeedPlayer {
  const positions: SeedPlayer["position"][] = ["PG", "SG", "SF", "PF", "C"];
  const position = positions[index % positions.length];
  const starSeed = hash(`${team.abbrev}-bench-${index}`);
  const random = rng(starSeed);
  const age = 22 + Math.floor(random() * 9);
  const ovr = 71 + Math.floor(random() * 8);

  return {
    name: `${team.city} ${team.team} Bench ${index + 1}`,
    position,
    age,
    ovr,
    salary: 1800000 + Math.floor(random() * 4200000),
  };
}

function deriveRatings(team: SeedTeam, player: SeedPlayer, depthIndex: number) {
  const random = rng(hash(`${team.abbrev}-${player.name}`));
  const profile = positionProfiles[player.position];
  const height = positionHeights[player.position] + Math.floor(random() * 3) - 1;

  const overall = clamp(player.ovr, 60, 99);
  const ageCurve = player.age <= 24 ? 6 : player.age >= 33 ? -6 : 2;
  const potential = clamp(overall + ageCurve + Math.floor(random() * 5), 58, 99);

  const offense = clamp(overall + profile.offense + Math.floor(random() * 5) - 2, 50, 99);
  const defense = clamp(overall + profile.defense + Math.floor(random() * 5) - 2, 45, 99);
  const playmaking = clamp(overall + profile.playmaking + Math.floor(random() * 6) - 3, 40, 99);
  const rebounding = clamp(overall + profile.rebounding + Math.floor(random() * 6) - 3, 40, 99);

  const staminaBase = 86 - Math.max(0, player.age - 30) * 2;
  const stamina = clamp(staminaBase + Math.floor(random() * 9) - 4, 60, 98);

  const roleBoost = clamp(4 - depthIndex, 0, 4) * 3;
  const shotTendency = clamp(48 + profile.tendency + roleBoost + Math.floor(random() * 12), 18, 95);
  const touchShare = clamp(8 + roleBoost * 2 + Math.floor((overall - 70) / 2), 5, 38);

  return {
    height,
    overall,
    potential,
    offense,
    defense,
    playmaking,
    rebounding,
    stamina,
    shotTendency,
    touchShare,
  };
}

async function main() {
  const rosterPath = join(process.cwd(), "data", "rosters_2026.json");
  const rosters = JSON.parse(readFileSync(rosterPath, "utf8")) as SeedTeam[];

  await prisma.playerStats.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.game.deleteMany();
  await prisma.player.deleteMany();
  await prisma.leagueState.deleteMany();
  await prisma.team.deleteMany();

  const createdTeams: { id: string; abbrev: string }[] = [];

  for (const team of rosters) {
    const createdTeam = await prisma.team.create({
      data: {
        city: team.city,
        name: team.team,
        abbrev: team.abbrev,
        conference: team.conference,
        division: team.division,
        pace: team.pace,
        focus: team.focus,
      },
    });

    createdTeams.push({ id: createdTeam.id, abbrev: createdTeam.abbrev });

    const sortedPlayers = [...team.players].sort((a, b) => b.ovr - a.ovr);
    while (sortedPlayers.length < MIN_ROSTER_SIZE) {
      sortedPlayers.push(buildBenchPlayer(team, sortedPlayers.length));
    }

    for (const [index, player] of sortedPlayers.entries()) {
      const { firstName, lastName } = parseName(player.name);
      const ratings = deriveRatings(team, player, index);

      await prisma.player.create({
        data: {
          externalId: player.imgId,
          firstName,
          lastName,
          position: player.position,
          age: player.age,
          teamId: createdTeam.id,
          morale: 75 + Math.floor(rng(hash(player.name))() * 16),
          ...ratings,
          contract: {
            create: {
              amount: player.salary,
              yearsLeft: player.age > 34 ? 1 : player.age > 30 ? 2 : 3,
              type: "Guaranteed",
            },
          },
          stats: {
            create: {
              season: CURRENT_SEASON,
              gamesPlayed: 0,
              points: 0,
              rebounds: 0,
              assists: 0,
              minutes: 0,
              turnovers: 0,
            },
          },
        },
      });
    }
  }

  const freeAgents: SeedPlayer[] = [
    { name: "Dennis Smith Jr", position: "PG", age: 29, ovr: 75, salary: 2800000 },
    { name: "Lonnie Walker IV", position: "SG", age: 27, ovr: 77, salary: 3300000 },
    { name: "Marcus Morris Sr", position: "PF", age: 37, ovr: 73, salary: 2100000 },
    { name: "Bismack Biyombo", position: "C", age: 34, ovr: 72, salary: 2200000 },
    { name: "Ish Smith", position: "PG", age: 38, ovr: 70, salary: 1800000 },
  ];

  for (const [index, player] of freeAgents.entries()) {
    const tempTeam: SeedTeam = {
      team: "Free Agents",
      city: "NBA",
      abbrev: "FA",
      conference: "East",
      division: "Pool",
      pace: 50,
      focus: "Balanced",
      players: [],
    };

    const { firstName, lastName } = parseName(player.name);
    const ratings = deriveRatings(tempTeam, player, index + 5);

    await prisma.player.create({
      data: {
        externalId: player.imgId,
        firstName,
        lastName,
        position: player.position,
        age: player.age,
        teamId: null,
        morale: 72,
        ...ratings,
      },
    });
  }

  const teamIds = createdTeams.map((team) => team.id);
  const games: {
    season: number;
    day: number;
    homeTeamId: string;
    awayTeamId: string;
    isPlayed: boolean;
  }[] = [];

  for (let day = 1; day <= GAME_DAYS; day += 1) {
    const shuffled = seededShuffle(teamIds, hash(`schedule-${day}`));

    for (let slot = 0; slot < GAMES_PER_DAY; slot += 1) {
      const a = shuffled[slot * 2];
      const b = shuffled[slot * 2 + 1];
      if (!a || !b) {
        continue;
      }

      const isEven = (day + slot) % 2 === 0;
      games.push({
        season: CURRENT_SEASON,
        day,
        homeTeamId: isEven ? a : b,
        awayTeamId: isEven ? b : a,
        isPlayed: false,
      });
    }
  }

  await prisma.game.createMany({
    data: games,
  });

  const userTeam = createdTeams.find((team) => team.abbrev === "LAL") ?? createdTeams[0];

  await prisma.leagueState.create({
    data: {
      currentSeason: CURRENT_SEASON,
      currentDay: 1,
      salaryCap: 155000000,
      luxuryTax: 188000000,
      userTeamId: userTeam?.id,
    },
  });

  const playerCount = await prisma.player.count();
  const teamCount = await prisma.team.count();
  const gameCount = await prisma.game.count();

  console.log(`Seeded ${teamCount} teams, ${playerCount} players, ${gameCount} games.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
