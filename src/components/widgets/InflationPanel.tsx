import React from 'react';
import Widget from '../shared/Widget';
import SparklineChart from '../shared/SparklineChart';
import { TimeSeriesPoint, WidgetStatus } from '../../types';

interface InflationItem {
  label: string;
  sublabel: string;
  value: number;
  mom: number | null;
  series: TimeSeriesPoint[];
  dataThrough: string;
}

interface Props {
  data: InflationItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
}

const FED_TARGET = 2.0;

function MomBadge({ mom }: { mom: number }) {
  const sign = mom >= 0 ? '+' : '';
  const color = mom > 0 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <span className={`text-[10px] font-mono ${color}`}>
      {sign}{mom.toFixed(2)}% MoM
    </span>
  );
}

export default function InflationPanel({ data, onExpand, onRetry, dragHandleProps, status, badge, headerRight }: Props) {
  const [cpi, coreCpi, pce, corePce] = data.slice(0, 4);
  const expectations = data.slice(4);

  return (
    <Widget
      title="Inflation"
      subtitle="CPI · PCE · Market Expectations"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      badge={badge}
      headerRight={headerRight}
      skeletonRows={6}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[cpi, coreCpi, pce, corePce].filter(Boolean).map(item => {
            const aboveTarget = item.value > FED_TARGET;
            const valueColor = aboveTarget ? 'text-amber-400' : 'text-emerald-400';
            const sparkColor = aboveTarget ? '#fbbf24' : '#34d399';
            return (
              <div key={item.label} className="bg-slate-800/60 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 leading-tight">{item.label}</div>
                    <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{item.sublabel}</div>
                  </div>
                  <span className={`text-sm font-mono font-bold ${valueColor} shrink-0`}>
                    {item.value.toFixed(2)}%
                  </span>
                </div>
                <SparklineChart data={item.series} height={28} color={sparkColor} />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500">Data through {item.dataThrough}</span>
                  {item.mom !== null && <MomBadge mom={item.mom} />}
                </div>
              </div>
            );
          })}
        </div>

        {expectations.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-700/60" />
              <span className="text-[9px] uppercase tracking-widest text-slate-600 font-medium">Expectations</span>
              <div className="h-px flex-1 bg-slate-700/60" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {expectations.map(item => {
                const aboveTarget = item.value > FED_TARGET;
                const valueColor = aboveTarget ? 'text-amber-400' : 'text-emerald-400';
                const sparkColor = aboveTarget ? '#fbbf24' : '#34d399';
                return (
                  <div key={item.label} className="bg-slate-800/60 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-200 leading-tight">{item.label}</div>
                        <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{item.sublabel}</div>
                      </div>
                      <span className={`text-sm font-mono font-bold ${valueColor} shrink-0`}>
                        {item.value.toFixed(2)}%
                      </span>
                    </div>
                    {item.series.length > 0 && (
                      <SparklineChart data={item.series} height={28} color={sparkColor} />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">Data through {item.dataThrough}</span>
                      <span className="text-[9px] font-mono text-slate-600">Target {FED_TARGET.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Widget>
  );
}
