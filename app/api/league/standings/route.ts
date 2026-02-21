import { NextResponse } from "next/server";
import { getLeagueStateOrThrow } from "@/lib/league/core";
import { getStandings } from "@/lib/league/standings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const leagueState = await getLeagueStateOrThrow();
    const standings = await getStandings(leagueState.currentSeason);

    return NextResponse.json({
      season: leagueState.currentSeason,
      day: leagueState.currentDay,
      standings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load standings.",
      },
      { status: 500 },
    );
  }
}
