import React, { useState } from 'react';
import Widget from '../shared/Widget';
import ChangeIndicator from '../shared/ChangeIndicator';
import { PriceItem, WidgetStatus } from '../../types';

type Period = 'D' | 'W' | 'M';

const PERIOD_MULT: Record<Period, number> = { D: 1, W: 5, M: 22 };

interface Props {
  data: PriceItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

export default function EquitiesPanel({ data, onExpand, onRetry, dragHandleProps, status }: Props) {
  const [period, setPeriod] = useState<Period>('D');

  const adjustedData = data.map(item => ({
    ...item,
    change: parseFloat((item.change * PERIOD_MULT[period]).toFixed(2)),
    changePct: parseFloat((item.changePct * PERIOD_MULT[period]).toFixed(2)),
  }));

  return (
    <Widget
      title="Equities"
      subtitle="US Markets"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={5}
      headerRight={
        <div className="flex gap-1">
          {(['D', 'W', 'M'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-0.5 rounded font-mono transition-all ${
                period === p
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              1{p}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-1.5">
        {adjustedData.map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs text-slate-400 w-28 truncate group-hover:text-slate-300 transition-colors">
              {item.label}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-medium text-slate-100 tabular-nums">
                {item.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <div className="w-24 text-right">
                <ChangeIndicator
                  value={item.changePct}
                  suffix="%"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}
