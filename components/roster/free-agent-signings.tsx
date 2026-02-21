"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FreeAgent = {
  id: string;
  name: string;
  position: string;
  overall: number;
};

type FreeAgentSigningsProps = {
  teamId: string;
  freeAgents: FreeAgent[];
};

const DEFAULT_SALARY = 2_500_000;

export function FreeAgentSignings({ teamId, freeAgents }: FreeAgentSigningsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const signPlayer = async (playerId: string) => {
    setPendingId(playerId);
    setMessage("");

    const response = await fetch("/api/gm/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        playerId,
        amount: DEFAULT_SALARY,
        years: 1,
        type: "Guaranteed",
      }),
    });

    const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
    setPendingId(null);

    if (!response.ok || !data.success) {
      setMessage(data.error ?? "Unable to sign player.");
      return;
    }

    setMessage(data.message ?? "Player signed.");
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Free Agents</h2>
      <p className="mt-1 text-xs text-slate-500">Tap to sign for a 1-year minimum deal.</p>

      <div className="mt-3 space-y-2">
        {freeAgents.slice(0, 10).map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-700">
              {player.name} ({player.position}) OVR {player.overall}
            </p>
            <button
              type="button"
              onClick={() => signPlayer(player.id)}
              disabled={isPending || pendingId === player.id}
              className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pendingId === player.id ? "Signing..." : "Sign"}
            </button>
          </div>
        ))}
      </div>

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
