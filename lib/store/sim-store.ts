"use client";

import { create } from "zustand";

type SimStore = {
  speed: number;
  cursor: number;
  isPlaying: boolean;
  setSpeed: (speed: number) => void;
  setCursor: (cursor: number) => void;
  togglePlaying: () => void;
  reset: () => void;
};

export const useSimStore = create<SimStore>((set) => ({
  speed: 1,
  cursor: 0,
  isPlaying: true,
  setSpeed: (speed) => set({ speed }),
  setCursor: (cursor) => set({ cursor }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  reset: () => set({ speed: 1, cursor: 0, isPlaying: true }),
}));
