import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow } from "@/lib/league/core";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const leagueState = await getLeagueStateOrThrow();

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            contract: true,
            stats: {
              where: {
                season: leagueState.currentSeason,
              },
            },
          },
          orderBy: { overall: "desc" },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load roster.",
      },
      { status: 500 },
    );
  }
}
