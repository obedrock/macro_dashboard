import React from 'react';
import Widget from '../shared/Widget';
import SparklineChart from '../shared/SparklineChart';
import { TimeSeriesPoint, WidgetStatus } from '../../types';

interface InflationItem {
  label: string;
  value: number;
  series: TimeSeriesPoint[];
}

interface Props {
  data: InflationItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

const FED_TARGET = 2.0;

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
          return (
            <div key={item.label} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span
                  className={`text-xs font-mono font-semibold ${
                    aboveTarget ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {item.value.toFixed(1)}%
                </span>
              </div>
              <SparklineChart data={item.series} height={32} color={aboveTarget ? '#fbbf24' : '#34d399'} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Fed target</span>
                <span className="text-xs font-mono text-slate-500">{FED_TARGET.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
