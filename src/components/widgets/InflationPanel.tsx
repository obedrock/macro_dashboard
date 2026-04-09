import React from 'react';
import Widget from '../shared/Widget';
import SparklineChart from '../shared/SparklineChart';
import { TimeSeriesPoint, WidgetStatus } from '../../types';

interface InflationItem {
  label: string;
  value: number;
  series: TimeSeriesPoint[];
  latestDataDate?: string;
}

interface Props {
  data: InflationItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

const FED_TARGET = 2.0;

function formatPrintDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function InflationPanel({ data, onExpand, onRetry, dragHandleProps, status }: Props) {
  return (
    <Widget
      title="Inflation"
      subtitle="CPI & PCE readings"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={4}
    >
      <div className="grid grid-cols-2 gap-3">
        {data.map(item => {
          const aboveTarget = item.value > FED_TARGET;
          const printDate = formatPrintDate(item.latestDataDate);
          return (
            <div key={item.label} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span
                  className={`text-xs font-mono font-semibold ${
                    aboveTarget ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {item.value.toFixed(2)}%
                </span>
              </div>
              <SparklineChart data={item.series} height={32} color={aboveTarget ? '#fbbf24' : '#34d399'} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">
                  {printDate ? `As of ${printDate}` : 'Fed target'}
                </span>
                <span className="text-xs font-mono text-slate-500">{FED_TARGET.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
