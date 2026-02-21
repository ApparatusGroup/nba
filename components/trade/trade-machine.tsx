"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TradePlayer = {
  id: string;
  name: string;
  position: string;
  overall: number;
  salary: number;
};

type TradeTeam = {
  id: string;
  abbrev: string;
  name: string;
  city: string;
};

type TradeMachineProps = {
  userTeamId: string;
  teams: TradeTeam[];
  userPlayers: TradePlayer[];
};

type TeamRosterResponse = {
  id: string;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    overall: number;
    contract: { amount: number } | null;
  }>;
  error?: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function normalizeTeamPlayers(data: TeamRosterResponse): TradePlayer[] {
  return data.players.map((player) => ({
    id: player.id,
    name: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position,
    overall: player.overall,
    salary: player.contract?.amount ?? 0,
  }));
}

export function TradeMachine({ userTeamId, teams, userPlayers }: TradeMachineProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const partnerOptions = useMemo(() => teams.filter((team) => team.id !== userTeamId), [teams, userTeamId]);

  const [partnerTeamId, setPartnerTeamId] = useState(partnerOptions[0]?.id ?? "");
  const [partnerPlayers, setPartnerPlayers] = useState<TradePlayer[]>([]);
  const [loadingPartnerPlayers, setLoadingPartnerPlayers] = useState(false);
  const [sendPlayerIds, setSendPlayerIds] = useState<string[]>([]);
  const [receivePlayerIds, setReceivePlayerIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!partnerTeamId) {
      setPartnerPlayers([]);
      return;
    }

    const controller = new AbortController();

    const loadPartnerRoster = async () => {
      setLoadingPartnerPlayers(true);
      setMessage("");
      try {
        const response = await fetch(`/api/team/${partnerTeamId}/roster`, {
          signal: controller.signal,
        });

        const raw = (await response.json()) as TeamRosterResponse;
        if (!response.ok) {
          setPartnerPlayers([]);
          setMessage(raw.error ?? "Could not load trade partner roster.");
          return;
        }

        setPartnerPlayers(normalizeTeamPlayers(raw));
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setPartnerPlayers([]);
          setMessage("Could not load trade partner roster.");
        }
      } finally {
        setLoadingPartnerPlayers(false);
      }
    };

    loadPartnerRoster();

    return () => {
      controller.abort();
    };
  }, [partnerTeamId]);

  const outgoingSalary = userPlayers
    .filter((player) => sendPlayerIds.includes(player.id))
    .reduce((sum, player) => sum + player.salary, 0);

  const incomingSalary = partnerPlayers
    .filter((player) => receivePlayerIds.includes(player.id))
    .reduce((sum, player) => sum + player.salary, 0);

  const toggle = (
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    max = 3,
  ) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
      return;
    }
    if (current.length >= max) {
      return;
    }
    setter([...current, value]);
  };

  const submit = async () => {
    setMessage("");
    const response = await fetch("/api/gm/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerTeamId,
        sendPlayerIds,
        receivePlayerIds,
      }),
    });

    const data = (await response.json()) as { accepted?: boolean; message?: string; reason?: string; error?: string };

    if (!response.ok) {
      setMessage(data.error ?? data.reason ?? "Trade failed.");
      return;
    }

    if (!data.accepted) {
      setMessage(data.reason ?? "Trade declined.");
      return;
    }

    setMessage(data.message ?? "Trade accepted.");
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="partnerTeam" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Trade Partner
        </label>
        <select
          id="partnerTeam"
          value={partnerTeamId}
          onChange={(event) => {
            setPartnerTeamId(event.target.value);
            setSendPlayerIds([]);
            setReceivePlayerIds([]);
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
        >
          {partnerOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.city} {team.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">You Send (max 3)</h3>
          <div className="space-y-2">
            {userPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggle(player.id, sendPlayerIds, setSendPlayerIds)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                  sendPlayerIds.includes(player.id)
                    ? "border-orange-500 bg-orange-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {player.name} ({player.position}) OVR {player.overall} | {money.format(player.salary)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">You Receive (max 3)</h3>
          {loadingPartnerPlayers ? <p className="text-xs text-slate-500">Loading roster...</p> : null}
          <div className="space-y-2">
            {partnerPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggle(player.id, receivePlayerIds, setReceivePlayerIds)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                  receivePlayerIds.includes(player.id)
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {player.name} ({player.position}) OVR {player.overall} | {money.format(player.salary)}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">Outgoing: {money.format(outgoingSalary)}</p>
        <p className="text-sm text-slate-700">Incoming: {money.format(incomingSalary)}</p>
        <p className="text-sm font-semibold text-slate-900">Delta: {money.format(incomingSalary - outgoingSalary)}</p>

        <button
          type="button"
          onClick={submit}
          disabled={isPending || loadingPartnerPlayers || !sendPlayerIds.length || !receivePlayerIds.length}
          className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Processing..." : "Propose Trade"}
        </button>

        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
