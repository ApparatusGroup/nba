import { FreeAgentSignings } from "@/components/roster/free-agent-signings";
import { prisma } from "@/lib/db/prisma";
import { getLeagueStateOrThrow, resolveUserTeamId } from "@/lib/league/core";
import { currency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const leagueState = await getLeagueStateOrThrow();
  const userTeamId = leagueState.userTeamId ?? (await resolveUserTeamId());

  const [team, freeAgents] = await Promise.all([
    prisma.team.findUnique({
      where: { id: userTeamId },
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
          orderBy: [{ overall: "desc" }, { position: "asc" }],
        },
      },
    }),
    prisma.player.findMany({
      where: {
        teamId: null,
      },
      orderBy: { overall: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        overall: true,
      },
      take: 15,
    }),
  ]);

  if (!team) {
    return <p className="text-sm text-red-600">No roster available.</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="font-heading text-3xl text-slate-900">{team.city} {team.name} Roster</h1>
        <p className="mt-1 text-sm text-slate-500">Tap rows on Trade screen to move players. This page is read-first and mobile friendly.</p>
      </section>

      <section className="space-y-2">
        {team.players.map((player) => {
          const stats = player.stats[0];
          return (
            <article key={player.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {player.firstName} {player.lastName}
                  </h2>
                  <p className="text-xs text-slate-500">{player.position} | Age {player.age}</p>
                </div>
                <div className="rounded-lg bg-orange-100 px-2 py-1 text-sm font-semibold text-orange-700">
                  OVR {player.overall}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <p>Salary: {currency.format(player.contract?.amount ?? 0)}</p>
                <p>Years: {player.contract?.yearsLeft ?? 0}</p>
                <p>PPG: {stats && stats.gamesPlayed > 0 ? (stats.points / stats.gamesPlayed).toFixed(1) : "0.0"}</p>
                <p>APG: {stats && stats.gamesPlayed > 0 ? (stats.assists / stats.gamesPlayed).toFixed(1) : "0.0"}</p>
              </div>
            </article>
          );
        })}
      </section>

      <FreeAgentSignings
        teamId={team.id}
        freeAgents={freeAgents.map((player) => ({
          id: player.id,
          name: `${player.firstName} ${player.lastName}`.trim(),
          position: player.position,
          overall: player.overall,
        }))}
      />
    </div>
  );
}
