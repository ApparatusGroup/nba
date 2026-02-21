"use client";

import { useEffect } from "react";
import { useSimStore } from "@/lib/store/sim-store";

type SimCastProps = {
  gameTitle: string;
  log: string[];
};

const SPEED_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "1x", value: 1 },
  { label: "10x", value: 10 },
  { label: "Instant", value: 999 },
];

export function SimCast({ gameTitle, log }: SimCastProps) {
  const { speed, cursor, isPlaying, setSpeed, setCursor, togglePlaying, reset } = useSimStore();

  useEffect(() => {
    reset();
  }, [gameTitle, reset]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (cursor >= log.length) {
      return;
    }

    if (speed >= 999) {
      setCursor(log.length);
      return;
    }

    const delay = speed === 10 ? 100 : 850;
    const timer = window.setTimeout(() => {
      setCursor(Math.min(log.length, cursor + 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [cursor, isPlaying, log.length, setCursor, speed]);

  const visible = log.slice(0, cursor);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlaying}
          className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        {SPEED_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSpeed(option.value)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              speed === option.value ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
        >
          Restart
        </button>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl bg-slate-950 px-3 py-3 text-xs text-slate-200">
        {!visible.length ? <p className="text-slate-400">Press play to begin playback.</p> : null}
        {visible.map((entry, index) => (
          <p key={`${entry}-${index}`}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
