import React, { useState } from 'react';
import { Maximize2, GripVertical, RefreshCw, AlertCircle } from 'lucide-react';
import { WidgetStatus } from '../../types';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  status?: WidgetStatus;
  skeletonRows?: number;
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 px-2">
          <div className="h-3 rounded bg-slate-800 animate-pulse" style={{ width: `${40 + (i % 3) * 15}%` }} />
          <div className="flex gap-3">
            <div className="h-3 w-16 rounded bg-slate-800 animate-pulse" />
            <div className="h-3 w-12 rounded bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Widget({
  title,
  subtitle,
  children,
  onExpand,
  onRetry,
  dragHandleProps,
  isDragging,
  badge,
  headerRight,
  className = '',
  status,
  skeletonRows = 5,
}: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        bg-slate-900 border-slate-800
        dark:bg-slate-900 dark:border-slate-800
        light-widget
        ${isDragging ? 'opacity-50 scale-95 shadow-2xl' : ''}
        ${hovered ? 'border-slate-700' : ''}
        ${className}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical size={14} />
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-slate-200 tracking-wide">{title}</span>
            {subtitle && (
              <span className="ml-2 text-xs text-slate-500">{subtitle}</span>
            )}
          </div>
          {badge && <div className="ml-2">{badge}</div>}
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {status?.state === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-500/20 transition-all"
              title={status.error}
            >
              <RefreshCw size={10} />
              Retry
            </button>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
              title="Expand"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {status?.state === 'loading' ? (
          <SkeletonRows rows={skeletonRows} />
        ) : status?.state === 'error' ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <AlertCircle size={20} className="text-amber-500" />
            <div>
              <p className="text-xs text-slate-400">Failed to load data</p>
              {status.error && <p className="text-xs text-slate-600 mt-0.5 font-mono truncate max-w-48">{status.error}</p>}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <RefreshCw size={11} />
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
