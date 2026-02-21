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
  dayComplete?: boolean;
  remainingGames?: number;
  nextSeason?: number;
  nextDay?: number;
  rolledOver?: boolean;
};

const MAX_SIM_REQUESTS = 12;
const GAMES_PER_REQUEST = 2;

function parseSimResponse(rawText: string, status: number): SimResponse {
  try {
    return JSON.parse(rawText) as SimResponse;
  } catch {
    return {
      simulatedGames: [],
      error: rawText || `Request failed with status ${status}.`,
    };
  }
}

export function QuickSimButton() {
  const router = useRouter();
  const [result, setResult] = useState<SimResponse | null>(null);
  const [recentGames, setRecentGames] = useState<SimulatedGame[]>([]);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [totalSimulated, setTotalSimulated] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = async () => {
    setResult(null);
    setRecentGames([]);
    setTotalSimulated(0);
    setStatusLabel("Starting simulation...");
    setIsSimulating(true);

    try {
      for (let attempt = 1; attempt <= MAX_SIM_REQUESTS; attempt += 1) {
        setStatusLabel(`Simulating batch ${attempt}...`);

        const response = await fetch("/api/sim/day", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ maxGames: GAMES_PER_REQUEST }),
        });

        const rawText = await response.text();
        const data = parseSimResponse(rawText, response.status);
        setResult(data);

        if (!response.ok) {
          setStatusLabel("Simulation failed.");
          return;
        }

        const justSimulated = data.simulatedGames?.length ?? 0;
        if (justSimulated > 0) {
          setTotalSimulated((current) => current + justSimulated);
          setRecentGames((current) => [...data.simulatedGames, ...current].slice(0, 6));
        }

        const remaining = data.remainingGames ?? 0;
        setStatusLabel(
          remaining > 0
            ? `Simulating... ${remaining} game${remaining === 1 ? "" : "s"} left on day ${data.nextDay ?? "?"}.`
            : `Day complete. Advanced to day ${data.nextDay ?? "?"}.`,
        );

        if (data.dayComplete || data.rolledOver || justSimulated === 0) {
          break;
        }
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setResult({
        simulatedGames: [],
        error: error instanceof Error ? error.message : "Simulation request failed.",
      });
      setStatusLabel("Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || isSimulating}
        className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {isSimulating || isPending ? "Simulating..." : "Quick Sim Current Day"}
      </button>

      {statusLabel ? <p className="mt-3 text-sm text-slate-600">{statusLabel}</p> : null}

      {totalSimulated > 0 ? (
        <p className="mt-2 text-xs font-semibold text-slate-700">
          Simulated {totalSimulated} game{totalSimulated === 1 ? "" : "s"} this run.
        </p>
      ) : null}

      {result?.error ? (
        <p className="mt-3 text-sm text-red-600">{result.error}</p>
      ) : null}

      {result?.message ? <p className="mt-3 text-sm text-slate-600">{result.message}</p> : null}

      {recentGames.length ? (
        <ul className="mt-3 space-y-2 text-xs text-slate-700">
          {recentGames.map((game) => (
            <li key={game.id} className="rounded-lg bg-slate-50 px-2 py-1">
              {game.awayTeam} {game.awayScore} @ {game.homeTeam} {game.homeScore}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
