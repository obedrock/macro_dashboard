import React from 'react';

interface Props {
  lastFetched: number;
  now: number;
}

export default function FreshnessLabel({ lastFetched, now }: Props) {
  if (lastFetched === 0) return null;
  const ageMs = now - lastFetched;
  const ageMins = Math.floor(ageMs / 60_000);

  let label: string;
  let colorClass: string;

  if (ageMins < 1) {
    label = 'Just now';
    colorClass = 'text-slate-500';
  } else if (ageMins < 5) {
    label = `Updated ${ageMins}m ago`;
    colorClass = 'text-slate-500';
  } else if (ageMins < 30) {
    label = `Updated ${ageMins}m ago`;
    colorClass = 'text-amber-400';
  } else {
    label = `Cached ${ageMins}m ago`;
    colorClass = 'text-red-400';
  }

  return <span className={`text-xs font-mono tabular-nums ${colorClass}`}>{label}</span>;
}
