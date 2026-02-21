import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, resolveUserTeamId, rolloverSeason } from "@/lib/league/core";
import { simulateGame } from "@/lib/simulation/engine";

export const runtime = "nodejs";
export const maxDuration = 30;
const REGULAR_SEASON_DAYS = 170;

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
  trackedTeamId: string,
): Promise<void> {
  const trackedLines = result.playerLines.filter((line) => line.teamId === trackedTeamId);
  const linesToPersist = trackedLines.length > 0 ? trackedLines : result.playerLines;

  await prisma.game.update({
    where: { id: gameId },
    data: {
      isPlayed: true,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      playLog: result.playLog.slice(0, 90),
    },
  });

  const playerRows = linesToPersist.map((line) =>
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

  const statsRows = linesToPersist.map((line) =>
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

async function fastSimulateLeagueGames(
  season: number,
  fromDay: number,
  toDay: number,
  excludedGameId: string,
): Promise<number> {
  const updatedRows = await prisma.$executeRaw`
    UPDATE "Game" AS g
    SET
      "isPlayed" = TRUE,
      "homeScore" = FLOOR(88 + ((h."pace" + a."pace") / 2.0) * 0.35 + random() * 26 + 2)::int,
      "awayScore" = FLOOR(87 + ((h."pace" + a."pace") / 2.0) * 0.35 + random() * 26)::int,
      "playLog" = NULL
    FROM "Team" AS h,
      "Team" AS a
    WHERE g."homeTeamId" = h."id"
      AND g."awayTeamId" = a."id"
      AND g."season" = ${season}
      AND g."isPlayed" = FALSE
      AND g."day" >= ${fromDay}
      AND g."day" <= ${toDay}
      AND g."id" <> ${excludedGameId}
  `;

  return Number(updatedRows);
}

async function advanceToDayAfterTarget(
  leagueStateId: string,
  currentSeason: number,
  targetDay: number,
): Promise<{ nextSeason: number; nextDay: number; rolledOver: boolean }> {
  const maxDay = REGULAR_SEASON_DAYS;

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

    const quickSimulatedGames = await fastSimulateLeagueGames(
      leagueState.currentSeason,
      leagueState.currentDay,
      nextUserGame.day,
      nextUserGame.id,
    );

    const fullResult = simulateGame({
      gameId: nextUserGame.id,
      season: nextUserGame.season,
      day: nextUserGame.day,
      home: nextUserGame.homeTeam,
      away: nextUserGame.awayTeam,
      rngSalt: randomUUID(),
    });

    await persistFullGameResult(
      leagueState.currentSeason,
      nextUserGame.id,
      fullResult,
      userTeamId,
    );

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
      quickSimulatedGames,
      message:
        quickSimulatedGames > 0
          ? `Simulated ${quickSimulatedGames} league game${quickSimulatedGames === 1 ? "" : "s"} and your next matchup.`
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
