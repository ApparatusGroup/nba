import Link from "next/link";
import { notFound } from "next/navigation";
import { SimCast } from "@/components/simulation/sim-cast";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!game) {
    notFound();
  }

  const playLog = Array.isArray(game.playLog)
    ? game.playLog.filter((line): line is string => typeof line === "string")
    : [];

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-block text-sm font-semibold text-teal-700">
        Back to Dashboard
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Day {game.day}</p>
        <h1 className="mt-1 font-heading text-3xl text-slate-900">
          {game.awayTeam.abbrev} @ {game.homeTeam.abbrev}
        </h1>
        <p className="mt-2 text-2xl font-semibold text-slate-900">
          {game.isPlayed ? `${game.awayScore} - ${game.homeScore}` : "Not simulated yet"}
        </p>
      </section>

      {game.isPlayed ? (
        <SimCast
          gameTitle={`${game.awayTeam.abbrev}-${game.homeTeam.abbrev}-${game.id}`}
          log={playLog.length ? playLog : ["No play log available for this game."]}
        />
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This game has not been simulated yet. Use Quick Sim on the dashboard.
        </p>
      )}
    </div>
  );
}
