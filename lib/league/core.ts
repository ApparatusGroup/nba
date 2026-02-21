import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getLeagueStateOrThrow() {
  const leagueState = await prisma.leagueState.findFirst();
  if (!leagueState) {
    throw new Error("League not initialized. Run prisma migrations and seed.");
  }
  return leagueState;
}

export async function resolveUserTeamId(): Promise<string> {
  const leagueState = await getLeagueStateOrThrow();

  if (leagueState.userTeamId) {
    return leagueState.userTeamId;
  }

  const firstTeam = await prisma.team.findFirst({ orderBy: { city: "asc" }, select: { id: true } });
  if (!firstTeam) {
    throw new Error("No teams found.");
  }

  await prisma.leagueState.update({
    where: { id: leagueState.id },
    data: { userTeamId: firstTeam.id },
  });

  return firstTeam.id;
}

export async function getTeamPayroll(teamId: string): Promise<number> {
  const contracts = await prisma.contract.findMany({
    where: {
      player: {
        teamId,
      },
    },
    select: {
      amount: true,
    },
  });

  return contracts.reduce((sum, contract) => sum + contract.amount, 0);
}

export async function rolloverSeason(tx: PrismaClient | Prisma.TransactionClient, season: number): Promise<void> {
  const nextSeason = season + 1;

  const priorSeasonGames = await tx.game.findMany({
    where: { season },
    select: {
      day: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });

  await tx.game.createMany({
    data: priorSeasonGames.map((game) => ({
      season: nextSeason,
      day: game.day,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      isPlayed: false,
      homeScore: 0,
      awayScore: 0,
    })),
  });

  const contracts = await tx.contract.findMany({
    select: {
      id: true,
      playerId: true,
      yearsLeft: true,
    },
  });

  for (const contract of contracts) {
    if (contract.yearsLeft <= 1) {
      await tx.contract.delete({ where: { id: contract.id } });
      await tx.player.update({ where: { id: contract.playerId }, data: { teamId: null } });
      continue;
    }

    await tx.contract.update({
      where: { id: contract.id },
      data: { yearsLeft: contract.yearsLeft - 1 },
    });
  }

  await tx.player.updateMany({
    data: {
      fatigue: 0,
      morale: 80,
      age: { increment: 1 },
    },
  });
}
