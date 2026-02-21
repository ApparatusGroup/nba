import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, rolloverSeason } from "@/lib/league/core";
import { simulateGame } from "@/lib/simulation/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 2;

type SimulatedGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

type SimOutputEntry = {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  result: ReturnType<typeof simulateGame>;
};

async function getBatchSize(request: Request): Promise<number> {
  try {
    const body = (await request.json()) as { maxGames?: unknown };
    if (typeof body.maxGames !== "number") {
      return DEFAULT_BATCH_SIZE;
    }

    const batchSize = Math.floor(body.maxGames);
    return Math.min(MAX_BATCH_SIZE, Math.max(1, batchSize));
  } catch {
    return DEFAULT_BATCH_SIZE;
  }
}

async function advanceDayOrSeason(leagueStateId: string, currentSeason: number, currentDay: number) {
  const maxDayResult = await prisma.game.aggregate({
    where: { season: currentSeason },
    _max: { day: true },
  });

  const maxDay = maxDayResult._max.day ?? currentDay;

  if (currentDay >= maxDay) {
    await rolloverSeason(prisma, currentSeason);
    await prisma.leagueState.update({
      where: { id: leagueStateId },
      data: {
        currentSeason: currentSeason + 1,
        currentDay: 1,
      },
    });

    return { nextSeason: currentSeason + 1, nextDay: 1, rolledOver: true };
  }

  await prisma.leagueState.update({
    where: { id: leagueStateId },
    data: { currentDay: currentDay + 1 },
  });

  return { nextSeason: currentSeason, nextDay: currentDay + 1, rolledOver: false };
}

function getMoraleDelta(
  teamId: string,
  winnerTeamId: string,
  loserTeamId: string,
): number {
  if (teamId === winnerTeamId) {
    return 1;
  }
  if (teamId === loserTeamId) {
    return -1;
  }
  return 0;
}

async function persistSimResult(season: number, entry: SimOutputEntry): Promise<void> {
  await prisma.game.update({
    where: { id: entry.gameId },
    data: {
      isPlayed: true,
      homeScore: entry.result.homeScore,
      awayScore: entry.result.awayScore,
      playLog: entry.result.playLog,
    },
  });

  const playerRows = entry.result.playerLines.map((line) =>
    Prisma.sql`(${line.playerId}, ${line.fatigue}, ${getMoraleDelta(
      line.teamId,
      entry.result.winnerTeamId,
      entry.result.loserTeamId,
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

  const statRows = entry.result.playerLines.map((line) =>
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

  if (statRows.length > 0) {
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
      VALUES ${Prisma.join(statRows)}
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

export async function POST(request: Request) {
  try {
    const batchSize = await getBatchSize(request);
    const leagueState = await getLeagueStateOrThrow();

    const games = await prisma.game.findMany({
      where: {
        season: leagueState.currentSeason,
        day: leagueState.currentDay,
        isPlayed: false,
      },
      take: batchSize,
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
      orderBy: {
        id: "asc",
      },
    });

    if (games.length === 0) {
      const advanced = await advanceDayOrSeason(
        leagueState.id,
        leagueState.currentSeason,
        leagueState.currentDay,
      );

      return NextResponse.json({
        simulatedGames: [],
        message: "No unplayed games on this day. League advanced automatically.",
        dayComplete: true,
        remainingGames: 0,
        ...advanced,
      });
    }

    const simOutput: SimOutputEntry[] = [];

    for (const game of games) {
      const result = simulateGame({
        gameId: game.id,
        season: game.season,
        day: game.day,
        home: game.homeTeam,
        away: game.awayTeam,
        rngSalt: randomUUID(),
      });

      simOutput.push({
        gameId: game.id,
        homeTeamName: `${game.homeTeam.city} ${game.homeTeam.name}`,
        awayTeamName: `${game.awayTeam.city} ${game.awayTeam.name}`,
        result,
      });
    }

    for (const entry of simOutput) {
      await persistSimResult(leagueState.currentSeason, entry);
    }

    const remainingGames = await prisma.game.count({
      where: {
        season: leagueState.currentSeason,
        day: leagueState.currentDay,
        isPlayed: false,
      },
    });

    const dayComplete = remainingGames === 0;
    const advanced = dayComplete
      ? await advanceDayOrSeason(
          leagueState.id,
          leagueState.currentSeason,
          leagueState.currentDay,
        )
      : {
          nextSeason: leagueState.currentSeason,
          nextDay: leagueState.currentDay,
          rolledOver: false,
        };

    const simulatedGames: SimulatedGame[] = simOutput.map((entry) => ({
      id: entry.gameId,
      homeTeam: entry.homeTeamName,
      awayTeam: entry.awayTeamName,
      homeScore: entry.result.homeScore,
      awayScore: entry.result.awayScore,
    }));

    return NextResponse.json({
      simulatedGames,
      message: dayComplete
        ? `Day ${leagueState.currentDay} complete.`
        : `${remainingGames} game${remainingGames === 1 ? "" : "s"} left today.`,
      dayComplete,
      remainingGames,
      ...advanced,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Simulation failed.",
      },
      { status: 500 },
    );
  }
}
