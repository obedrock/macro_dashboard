import React from 'react';
import Widget from '../shared/Widget';
import ChangeIndicator from '../shared/ChangeIndicator';
import { PriceItem, WidgetStatus } from '../../types';

interface Props {
  data: PriceItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

function getDecimals(label: string, value: number): number {
  if (label === 'DXY') return 2;
  if (label === 'USD/JPY') return 2;
  if (label === 'USD/CNY') return 4;
  return 4;
}

export default function FXPanel({ data, onExpand, onRetry, dragHandleProps, status }: Props) {
  return (
    <Widget
      title="FX Markets"
      subtitle="Foreign Exchange"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={5}
    >
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs text-slate-400 w-24 truncate group-hover:text-slate-300 transition-colors font-mono">
              {item.label}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-medium text-slate-100 tabular-nums">
                {item.value.toFixed(getDecimals(item.label, item.value))}
              </span>
              <div className="w-24 text-right">
                <ChangeIndicator value={item.changePct} suffix="%" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}
