import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  value: number;
  suffix?: string;
  prefix?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ChangeIndicator({
  value,
  suffix = '',
  prefix = '',
  showIcon = true,
  size = 'sm',
}: Props) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  const colorClass = isNeutral
    ? 'text-slate-400'
    : isPositive
    ? 'text-emerald-400'
    : 'text-red-400';

  const sizeClass =
    size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs';

  const iconSize = size === 'lg' ? 14 : 12;

  const formatted = `${prefix}${Math.abs(value).toFixed(
    Math.abs(value) < 1 && !suffix.includes('%') ? 4 : 2
  )}${suffix}`;

  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${colorClass} ${sizeClass}`}>
      {showIcon &&
        (isNeutral ? (
          <Minus size={iconSize} />
        ) : isPositive ? (
          <TrendingUp size={iconSize} />
        ) : (
          <TrendingDown size={iconSize} />
        ))}
      {!isNeutral && (isPositive ? '+' : '-')}
      {formatted}
    </span>
  );
}
