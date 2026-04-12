import React from 'react';
import Widget from '../shared/Widget';
import ChangeIndicator from '../shared/ChangeIndicator';
import SparklineChart from '../shared/SparklineChart';
import { TimeSeriesPoint, WidgetStatus } from '../../types';

interface CreditItem {
  label: string;
  value: number;
  change: number;
  series: TimeSeriesPoint[];
}

interface Props {
  data: CreditItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
}

const COLORS = ['#f87171', '#38bdf8', '#fb923c'];

export default function CreditPanel({ data, onExpand, onRetry, dragHandleProps, status, badge, headerRight }: Props) {
  return (
    <Widget
      title="Credit Spreads"
      subtitle="OAS basis points"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      badge={badge}
      headerRight={headerRight}
      skeletonRows={3}
    >
      <div className="space-y-3">
        {data.map((item, idx) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-slate-400">{item.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium text-slate-100">
                  {item.value} bps
                </span>
                <ChangeIndicator value={item.change} suffix=" bps" />
              </div>
            </div>
            <SparklineChart data={item.series.slice(-90)} color={COLORS[idx]} height={36} />
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800">
        <p className="text-xs text-slate-600">Wider spreads = tighter financial conditions</p>
      </div>
    </Widget>
  );
}
