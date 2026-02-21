import { getLeagueStateOrThrow } from "@/lib/league/core";
import { getStandings } from "@/lib/league/standings";

export const dynamic = "force-dynamic";

function ConferenceTable({
  rows,
  label,
}: {
  rows: Awaited<ReturnType<typeof getStandings>>;
  label: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((row, index) => (
          <div
            key={row.teamId}
            className="grid grid-cols-[2rem_3.5rem_1fr_3rem] items-center gap-2 rounded-lg bg-slate-50 px-2 py-2"
          >
            <span className="text-xs text-slate-500">{index + 1}</span>
            <span className="font-semibold text-slate-700">{row.abbrev}</span>
            <span className="truncate text-slate-700">{row.city}</span>
            <span className="text-right font-semibold text-slate-900">
              {row.wins}-{row.losses}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StandingsPage() {
  const leagueState = await getLeagueStateOrThrow();
  const standings = await getStandings(leagueState.currentSeason);

  const east = standings.filter((row) => row.conference === "East");
  const west = standings.filter((row) => row.conference === "West");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="font-heading text-3xl text-slate-900">Standings</h1>
        <p className="mt-1 text-sm text-slate-500">Season {leagueState.currentSeason}</p>
      </section>
      <ConferenceTable rows={east} label="Eastern Conference" />
      <ConferenceTable rows={west} label="Western Conference" />
    </div>
  );
}
