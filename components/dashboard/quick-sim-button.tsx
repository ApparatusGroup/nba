"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SimulatedGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

type SimResponse = {
  simulatedGames: SimulatedGame[];
  message?: string;
  error?: string;
};

export function QuickSimButton() {
  const router = useRouter();
  const [result, setResult] = useState<SimResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = async () => {
    setResult(null);
    const response = await fetch("/api/sim/day", { method: "POST" });
    const data = (await response.json()) as SimResponse;

    setResult(data);

    if (response.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {isPending ? "Simulating Day..." : "Quick Sim Current Day"}
      </button>

      {result?.error ? (
        <p className="mt-3 text-sm text-red-600">{result.error}</p>
      ) : null}

      {result?.message ? <p className="mt-3 text-sm text-slate-600">{result.message}</p> : null}

      {result?.simulatedGames?.length ? (
        <ul className="mt-3 space-y-2 text-xs text-slate-700">
          {result.simulatedGames.slice(0, 3).map((game) => (
            <li key={game.id} className="rounded-lg bg-slate-50 px-2 py-1">
              {game.awayTeam} {game.awayScore} @ {game.homeTeam} {game.homeScore}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
