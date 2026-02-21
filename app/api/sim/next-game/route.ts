import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, resolveUserTeamId, rolloverSeason } from "@/lib/league/core";
import { simulateGame } from "@/lib/simulation/engine";

export const runtime = "nodejs";
export const maxDuration = 30;

type TeamRating = {
  pace: number;
  rating: number;
};

type QuickGame = {
  id: string;
  day: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: {
    id: string;
    city: string;
    name: string;
    pace: number;
    focus: string;
  };
  awayTeam: {
    id: string;
    city: string;
    name: string;
    pace: number;
    focus: string;
  };
};

type QuickResult = {
  gameId: string;
  homeScore: number;
  awayScore: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rngFromText(seedText: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return ((hash >>> 0) % 10000) / 10000;
  };
}

function getTeamFocusBonus(focus: string): number {
  if (focus === "3PT") {
    return 2;
  }

  if (focus === "Inside") {
    return 1;
  }

  return 0;
}

function simulateQuickGame(game: QuickGame, ratings: Map<string, TeamRating>): QuickResult {
  const random = rngFromText(`${game.id}-${randomUUID()}`);
  const home = ratings.get(game.homeTeamId);
  const away = ratings.get(game.awayTeamId);

  const homeRating = home?.rating ?? 78;
  const awayRating = away?.rating ?? 78;
  const homePace = home?.pace ?? 50;
  const awayPace = away?.pace ?? 50;

  const paceBand = ((homePace + awayPace) / 2 - 50) * 0.7;
  const ratingDiff = (homeRating - awayRating) * 0.9;

  const homeScore = Math.round(
    clamp(
      102 + paceBand + ratingDiff + getTeamFocusBonus(game.homeTeam.focus) + (random() - 0.5) * 20 + 2,
      78,
      146,
    ),
  );

  let awayScore = Math.round(
    clamp(
      101 + paceBand - ratingDiff + getTeamFocusBonus(game.awayTeam.focus) + (random() - 0.5) * 20,
      76,
      144,
    ),
  );

  if (awayScore === homeScore) {
    awayScore += random() < 0.5 ? 1 : -1;
  }

  return {
    gameId: game.id,
    homeScore,
    awayScore,
  };
}

function getMoraleDelta(teamId: string, winnerTeamId: string, loserTeamId: string): number {
  if (teamId === winnerTeamId) {
    return 1;
  }

  if (teamId === loserTeamId) {
    return -1;
  }

  return 0;
}

async function persistFullGameResult(
  season: number,
  gameId: string,
  result: ReturnType<typeof simulateGame>,
): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      isPlayed: true,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      playLog: result.playLog,
    },
  });

  const playerRows = result.playerLines.map((line) =>
    Prisma.sql`(${line.playerId}, ${line.fatigue}, ${getMoraleDelta(
      line.teamId,
      result.winnerTeamId,
      result.loserTeamId,
    )})`,
  );

  if (playerRows.length > 0) {
    await prisma.$executeRaw`
      UPDATE "Player" AS p
      SET
        "fatigue" = v.fatigue,
        "morale" = LEAST(100, GREATEST(0, p."morale" + v.morale_delta))
      FROM (
        VALUES ${Prisma.join(playerRows)}
      ) AS v(player_id, fatigue, morale_delta)
      WHERE p."id" = v.player_id
    `;
  }

  const statsRows = result.playerLines.map((line) =>
    Prisma.sql`(
      ${randomUUID()},
      ${line.playerId},
      ${season},
      ${line.minutes > 0 ? 1 : 0},
      ${line.points},
      ${line.rebounds},
      ${line.assists},
      ${line.minutes},
      ${line.turnovers}
    )`,
  );

  if (statsRows.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "PlayerStats" (
        "id",
        "playerId",
        "season",
        "gamesPlayed",
        "points",
        "rebounds",
        "assists",
        "minutes",
        "turnovers"
      )
      VALUES ${Prisma.join(statsRows)}
      ON CONFLICT ("playerId", "season")
      DO UPDATE SET
        "gamesPlayed" = "PlayerStats"."gamesPlayed" + EXCLUDED."gamesPlayed",
        "points" = "PlayerStats"."points" + EXCLUDED."points",
        "rebounds" = "PlayerStats"."rebounds" + EXCLUDED."rebounds",
        "assists" = "PlayerStats"."assists" + EXCLUDED."assists",
        "minutes" = "PlayerStats"."minutes" + EXCLUDED."minutes",
        "turnovers" = "PlayerStats"."turnovers" + EXCLUDED."turnovers"
    `;
  }
}

async function persistQuickResults(quickResults: QuickResult[]): Promise<void> {
  if (quickResults.length === 0) {
    return;
  }

  const rows = quickResults.map((result) =>
    Prisma.sql`(${result.gameId}, ${result.homeScore}, ${result.awayScore})`,
  );

  await prisma.$executeRaw`
    UPDATE "Game" AS g
    SET
      "isPlayed" = TRUE,
      "homeScore" = v.home_score,
      "awayScore" = v.away_score
    FROM (
      VALUES ${Prisma.join(rows)}
    ) AS v(game_id, home_score, away_score)
    WHERE g."id" = v.game_id
  `;
}

async function buildRatingsMap(games: QuickGame[]): Promise<Map<string, TeamRating>> {
  const teamIds = [...new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId]))];

  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: teamIds,
      },
    },
    select: {
      id: true,
      pace: true,
      players: {
        select: {
          overall: true,
        },
        orderBy: {
          overall: "desc",
        },
        take: 5,
      },
    },
  });

  const map = new Map<string, TeamRating>();

  for (const team of teams) {
    const rating =
      team.players.length > 0
        ? team.players.reduce((sum, player) => sum + player.overall, 0) / team.players.length
        : 78;

    map.set(team.id, {
      pace: team.pace,
      rating,
    });
  }

  return map;
}

async function advanceToDayAfterTarget(
  leagueStateId: string,
  currentSeason: number,
  targetDay: number,
): Promise<{ nextSeason: number; nextDay: number; rolledOver: boolean }> {
  const maxDayResult = await prisma.game.aggregate({
    where: { season: currentSeason },
    _max: { day: true },
  });

  const maxDay = maxDayResult._max.day ?? targetDay;

  if (targetDay >= maxDay) {
    await rolloverSeason(prisma, currentSeason);
    await prisma.leagueState.update({
      where: { id: leagueStateId },
      data: {
        currentSeason: currentSeason + 1,
        currentDay: 1,
      },
    });

    return {
      nextSeason: currentSeason + 1,
      nextDay: 1,
      rolledOver: true,
    };
  }

  await prisma.leagueState.update({
    where: { id: leagueStateId },
    data: {
      currentDay: targetDay + 1,
    },
  });

  return {
    nextSeason: currentSeason,
    nextDay: targetDay + 1,
    rolledOver: false,
  };
}

export async function POST() {
  try {
    const leagueState = await getLeagueStateOrThrow();
    const userTeamId = leagueState.userTeamId ?? (await resolveUserTeamId());

    const nextUserGame = await prisma.game.findFirst({
      where: {
        season: leagueState.currentSeason,
        day: {
          gte: leagueState.currentDay,
        },
        isPlayed: false,
        OR: [{ homeTeamId: userTeamId }, { awayTeamId: userTeamId }],
      },
      include: {
        homeTeam: {
          include: {
            players: {
              include: {
                contract: true,
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              include: {
                contract: true,
              },
            },
          },
        },
      },
      orderBy: [{ day: "asc" }, { id: "asc" }],
    });

    if (!nextUserGame) {
      return NextResponse.json({
        simulatedGame: null,
        quickSimulatedGames: 0,
        message: "No upcoming user game found.",
        nextSeason: leagueState.currentSeason,
        nextDay: leagueState.currentDay,
        rolledOver: false,
      });
    }

    const gamesToProcess = (await prisma.game.findMany({
      where: {
        season: leagueState.currentSeason,
        day: {
          gte: leagueState.currentDay,
          lte: nextUserGame.day,
        },
        isPlayed: false,
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            city: true,
            name: true,
            pace: true,
            focus: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            city: true,
            name: true,
            pace: true,
            focus: true,
          },
        },
      },
      orderBy: [{ day: "asc" }, { id: "asc" }],
    })) as QuickGame[];

    const ratingsMap = await buildRatingsMap(gamesToProcess);
    const quickResults: QuickResult[] = [];

    for (const game of gamesToProcess) {
      if (game.id === nextUserGame.id) {
        continue;
      }

      quickResults.push(simulateQuickGame(game, ratingsMap));
    }

    await persistQuickResults(quickResults);

    const fullResult = simulateGame({
      gameId: nextUserGame.id,
      season: nextUserGame.season,
      day: nextUserGame.day,
      home: nextUserGame.homeTeam,
      away: nextUserGame.awayTeam,
      rngSalt: randomUUID(),
    });

    await persistFullGameResult(leagueState.currentSeason, nextUserGame.id, fullResult);

    const advanced = await advanceToDayAfterTarget(
      leagueState.id,
      leagueState.currentSeason,
      nextUserGame.day,
    );

    return NextResponse.json({
      simulatedGame: {
        id: nextUserGame.id,
        day: nextUserGame.day,
        homeTeam: `${nextUserGame.homeTeam.city} ${nextUserGame.homeTeam.name}`,
        awayTeam: `${nextUserGame.awayTeam.city} ${nextUserGame.awayTeam.name}`,
        homeScore: fullResult.homeScore,
        awayScore: fullResult.awayScore,
      },
      quickSimulatedGames: quickResults.length,
      message:
        quickResults.length > 0
          ? `Simulated ${quickResults.length} league game${quickResults.length === 1 ? "" : "s"} and your next matchup.`
          : "Simulated your next matchup.",
      ...advanced,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to simulate next game.",
      },
      { status: 500 },
    );
  }
}
