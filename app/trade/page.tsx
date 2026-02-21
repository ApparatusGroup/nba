import { TradeMachine } from "@/components/trade/trade-machine";
import { prisma } from "@/lib/db/prisma";
import { resolveUserTeamId } from "@/lib/league/core";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const userTeamId = await resolveUserTeamId();

  const [userTeam, teams] = await Promise.all([
    prisma.team.findUnique({
      where: { id: userTeamId },
      include: {
        players: {
          include: {
            contract: true,
          },
          orderBy: { overall: "desc" },
        },
      },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        abbrev: true,
        city: true,
        name: true,
      },
      orderBy: { city: "asc" },
    }),
  ]);

  if (!userTeam) {
    return <p className="text-sm text-red-600">User team not found.</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="font-heading text-3xl text-slate-900">Trade Machine</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select up to 3 players on each side. Trade values, apron, and matching salary rules are enforced in API.
        </p>
      </section>

      <TradeMachine
        userTeamId={userTeamId}
        userPlayers={userTeam.players.map((player) => ({
          id: player.id,
          name: `${player.firstName} ${player.lastName}`.trim(),
          position: player.position,
          overall: player.overall,
          salary: player.contract?.amount ?? 0,
        }))}
        teams={teams.map((team) => ({
          id: team.id,
          abbrev: team.abbrev,
          city: team.city,
          name: team.name,
        }))}
      />
    </div>
  );
}
