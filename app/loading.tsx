export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-2xl bg-white/70" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
      <div className="h-36 animate-pulse rounded-2xl bg-white/70" />
      <p className="text-sm text-slate-600">Loading league data...</p>
    </div>
  );
}
