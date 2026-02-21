import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, getTeamPayroll, resolveUserTeamId } from "@/lib/league/core";
import { QuickSimButton } from "@/components/dashboard/quick-sim-button";
import { currency, formatRecord } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const leagueState = await getLeagueStateOrThrow();
  const userTeamId = leagueState.userTeamId ?? (await resolveUserTeamId());

  const [team, payroll, nextGame, dayGames, homeWins, homeLosses, awayWins, awayLosses] = await Promise.all([
    prisma.team.findUnique({ where: { id: userTeamId } }),
    getTeamPayroll(userTeamId),
    prisma.game.findFirst({
      where: {
        season: leagueState.currentSeason,
        day: { gte: leagueState.currentDay },
        isPlayed: false,
        OR: [{ homeTeamId: userTeamId }, { awayTeamId: userTeamId }],
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: [{ day: "asc" }, { id: "asc" }],
    }),
    prisma.game.findMany({
      where: {
        season: leagueState.currentSeason,
        day: leagueState.currentDay,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      take: 8,
      orderBy: { id: "asc" },
    }),
    prisma.game.count({
      where: {
        season: leagueState.currentSeason,
        isPlayed: true,
        homeTeamId: userTeamId,
        homeScore: {
          gt: prisma.game.fields.awayScore,
        },
      },
    }),
    prisma.game.count({
      where: {
        season: leagueState.currentSeason,
        isPlayed: true,
        homeTeamId: userTeamId,
        homeScore: {
          lt: prisma.game.fields.awayScore,
        },
      },
    }),
    prisma.game.count({
      where: {
        season: leagueState.currentSeason,
        isPlayed: true,
        awayTeamId: userTeamId,
        awayScore: {
          gt: prisma.game.fields.homeScore,
        },
      },
    }),
    prisma.game.count({
      where: {
        season: leagueState.currentSeason,
        isPlayed: true,
        awayTeamId: userTeamId,
        awayScore: {
          lt: prisma.game.fields.homeScore,
        },
      },
    }),
  ]);

  if (!team) {
    return <p className="text-sm text-red-600">No user team found. Seed the database first.</p>;
  }

  const wins = homeWins + awayWins;
  const losses = homeLosses + awayLosses;
  const capSpace = leagueState.salaryCap - payroll;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Season {leagueState.currentSeason}</p>
        <h1 className="font-heading text-3xl text-slate-900">{team.city} {team.name}</h1>
        <p className="mt-1 text-sm text-slate-600">Day {leagueState.currentDay} of the regular season</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Record</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatRecord(wins, losses)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Cap Space</p>
          <p className={`mt-1 text-2xl font-semibold ${capSpace >= 0 ? "text-teal-700" : "text-red-600"}`}>
            {currency.format(capSpace)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Next Opponent</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {nextGame
              ? `${nextGame.homeTeam.abbrev === team.abbrev ? "vs" : "@"} ${
                  nextGame.homeTeam.abbrev === team.abbrev ? nextGame.awayTeam.abbrev : nextGame.homeTeam.abbrev
                }`
              : "Season complete"}
          </p>
        </article>
      </section>

      <QuickSimButton />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Today&apos;s Slate</h2>
        <ul className="mt-3 space-y-2">
          {dayGames.length === 0 ? (
            <li className="text-sm text-slate-500">No games scheduled.</li>
          ) : (
            dayGames.map((game) => (
              <li key={game.id}>
                <Link
                  href={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span>
                    {game.awayTeam.abbrev} @ {game.homeTeam.abbrev}
                  </span>
                  <span className="font-semibold">
                    {game.isPlayed ? `${game.awayScore}-${game.homeScore}` : "Tipoff"}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
