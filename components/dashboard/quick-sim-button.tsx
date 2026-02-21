"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SimulatedGame = {
  id: string;
  day: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

type NextGameResponse = {
  simulatedGame?: SimulatedGame | null;
  quickSimulatedGames?: number;
  message?: string;
  error?: string;
  nextSeason?: number;
  nextDay?: number;
  rolledOver?: boolean;
};

function parseResponse(rawText: string, status: number): NextGameResponse {
  try {
    return JSON.parse(rawText) as NextGameResponse;
  } catch {
    return {
      error: rawText || `Request failed with status ${status}.`,
    };
  }
}

export function QuickSimButton() {
  const router = useRouter();
  const [result, setResult] = useState<NextGameResponse | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = async () => {
    setResult(null);
    setStatusLabel("Simulating to your next game...");
    setIsSimulating(true);

    try {
      const response = await fetch("/api/sim/next-game", {
        method: "POST",
      });

      const rawText = await response.text();
      const data = parseResponse(rawText, response.status);
      setResult(data);

      if (!response.ok) {
        setStatusLabel("Simulation failed.");
        return;
      }

      setStatusLabel(
        data.rolledOver
          ? `Season advanced. Now on season ${data.nextSeason}, day ${data.nextDay}.`
          : `Done. Now on day ${data.nextDay}.`,
      );

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Simulation request failed.",
      });
      setStatusLabel("Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  const game = result?.simulatedGame ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || isSimulating}
        className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {isSimulating || isPending ? "Simulating..." : "Sim To Next Game"}
      </button>

      {statusLabel ? <p className="mt-3 text-sm text-slate-600">{statusLabel}</p> : null}

      {result?.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}

      {result?.message ? <p className="mt-2 text-xs text-slate-600">{result.message}</p> : null}

      {typeof result?.quickSimulatedGames === "number" ? (
        <p className="mt-2 text-xs text-slate-700">
          Fast simulated league games: {result.quickSimulatedGames}
        </p>
      ) : null}

      {game ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Your Last Simmed Game (Day {game.day})</p>
          <p className="mt-1">
            {game.awayTeam} {game.awayScore} @ {game.homeTeam} {game.homeScore}
          </p>
        </div>
      ) : null}
    </div>
  );
}
