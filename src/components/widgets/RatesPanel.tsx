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

export default function RatesPanel({ data, onExpand, onRetry, dragHandleProps, status }: Props) {
  return (
    <Widget
      title="Interest Rates"
      subtitle="US Treasuries & Fed"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={7}
    >
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs text-slate-400 w-32 truncate group-hover:text-slate-300 transition-colors">
              {item.label}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-medium text-slate-100 tabular-nums">
                {item.value.toFixed(item.unit === 'bps' ? 1 : 3)}
                <span className="text-xs text-slate-500 ml-0.5">{item.unit}</span>
              </span>
              <div className="w-20 text-right">
                <ChangeIndicator
                  value={item.change}
                  suffix={item.unit === 'bps' ? ' bps' : ''}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-600">Yield curve slope</span>
        <span className="text-xs font-mono text-emerald-400">+30.5 bps</span>
      </div>
    </Widget>
  );
}
