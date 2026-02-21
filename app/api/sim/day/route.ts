import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, rolloverSeason } from "@/lib/league/core";
import { simulateGame } from "@/lib/simulation/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

type SimulatedGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

async function advanceDayOrSeason(leagueStateId: string, currentSeason: number, currentDay: number) {
  const maxDayResult = await prisma.game.aggregate({
    where: { season: currentSeason },
    _max: { day: true },
  });

  const maxDay = maxDayResult._max.day ?? currentDay;

  if (currentDay >= maxDay) {
    await prisma.$transaction(async (tx) => {
      await rolloverSeason(tx, currentSeason);
      await tx.leagueState.update({
        where: { id: leagueStateId },
        data: {
          currentSeason: currentSeason + 1,
          currentDay: 1,
        },
      });
    });

    return { nextSeason: currentSeason + 1, nextDay: 1, rolledOver: true };
  }

  await prisma.leagueState.update({
    where: { id: leagueStateId },
    data: { currentDay: currentDay + 1 },
  });

  return { nextSeason: currentSeason, nextDay: currentDay + 1, rolledOver: false };
}

export async function POST() {
  try {
    const leagueState = await getLeagueStateOrThrow();

    const games = await prisma.game.findMany({
      where: {
        season: leagueState.currentSeason,
        day: leagueState.currentDay,
        isPlayed: false,
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
        ...advanced,
      });
    }

    const simOutput: Array<{
      gameId: string;
      homeTeamId: string;
      awayTeamId: string;
      homeTeamName: string;
      awayTeamName: string;
      result: ReturnType<typeof simulateGame>;
    }> = [];

    for (const game of games) {
      const result = simulateGame({
        gameId: game.id,
        season: game.season,
        day: game.day,
        home: game.homeTeam,
        away: game.awayTeam,
      });

      simOutput.push({
        gameId: game.id,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: `${game.homeTeam.city} ${game.homeTeam.name}`,
        awayTeamName: `${game.awayTeam.city} ${game.awayTeam.name}`,
        result,
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const entry of simOutput) {
        await tx.game.update({
          where: { id: entry.gameId },
          data: {
            isPlayed: true,
            homeScore: entry.result.homeScore,
            awayScore: entry.result.awayScore,
            playLog: entry.result.playLog,
          },
        });

        for (const line of entry.result.playerLines) {
          const gamesPlayedIncrement = line.minutes > 0 ? 1 : 0;
          const moraleDelta =
            line.teamId === entry.result.winnerTeamId
              ? 1
              : line.teamId === entry.result.loserTeamId
                ? -1
                : 0;

          await tx.player.update({
            where: { id: line.playerId },
            data: {
              fatigue: line.fatigue,
              morale: { increment: moraleDelta },
            },
          });

          await tx.playerStats.upsert({
            where: {
              playerId_season: {
                playerId: line.playerId,
                season: leagueState.currentSeason,
              },
            },
            create: {
              playerId: line.playerId,
              season: leagueState.currentSeason,
              gamesPlayed: gamesPlayedIncrement,
              points: line.points,
              rebounds: line.rebounds,
              assists: line.assists,
              minutes: line.minutes,
              turnovers: line.turnovers,
            },
            update: {
              gamesPlayed: { increment: gamesPlayedIncrement },
              points: { increment: line.points },
              rebounds: { increment: line.rebounds },
              assists: { increment: line.assists },
              minutes: { increment: line.minutes },
              turnovers: { increment: line.turnovers },
            },
          });
        }
      }
    });

    const advanced = await advanceDayOrSeason(
      leagueState.id,
      leagueState.currentSeason,
      leagueState.currentDay,
    );

    const simulatedGames: SimulatedGame[] = simOutput.map((entry) => ({
      id: entry.gameId,
      homeTeam: entry.homeTeamName,
      awayTeam: entry.awayTeamName,
      homeScore: entry.result.homeScore,
      awayScore: entry.result.awayScore,
    }));

    return NextResponse.json({
      simulatedGames,
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
