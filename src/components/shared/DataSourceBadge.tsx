import React from 'react';
import { DataSource } from '../../types';

interface Props {
  source: DataSource;
}

const CONFIG: Record<Exclude<DataSource, 'live'>, { label: string; classes: string }> = {
  cache: { label: 'Cached', classes: 'bg-amber-400/10 text-amber-400 border-amber-500/20' },
  partial: { label: 'Partial', classes: 'bg-amber-400/10 text-amber-400 border-amber-500/20' },
  fallback: { label: 'Fallback', classes: 'bg-red-400/10 text-red-400 border-red-500/20' },
};

export default function DataSourceBadge({ source }: Props) {
  if (source === 'live') return null;
  const { label, classes } = CONFIG[source];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${classes}`}>
      {label}
    </span>
  );
}
