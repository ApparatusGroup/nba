import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, getTeamPayroll } from "@/lib/league/core";

export const runtime = "nodejs";

const signSchema = z.object({
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  amount: z.number().positive(),
  years: z.number().int().min(1).max(4),
  type: z.enum(["Guaranteed", "Player Option", "Team Option"]).default("Guaranteed"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { teamId, playerId, amount, years, type } = parsed.data;

    const [leagueState, player, teamPayroll] = await Promise.all([
      getLeagueStateOrThrow(),
      prisma.player.findUnique({ where: { id: playerId }, include: { contract: true } }),
      getTeamPayroll(teamId),
    ]);

    if (!player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    if (player.teamId) {
      return NextResponse.json({ error: "Player is not a free agent." }, { status: 400 });
    }

    if (teamPayroll + amount > leagueState.salaryCap) {
      return NextResponse.json({ error: "Insufficient cap space for this signing." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: { teamId },
      }),
      prisma.contract.upsert({
        where: { playerId },
        create: {
          playerId,
          amount,
          yearsLeft: years,
          type,
        },
        update: {
          amount,
          yearsLeft: years,
          type,
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: "Player signed." });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to sign player.",
      },
      { status: 500 },
    );
  }
}
