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
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export default function CommoditiesPanel({ data, onExpand, onRetry, dragHandleProps, status, badge, headerRight }: Props) {
  return (
    <Widget
      title="Commodities"
      subtitle="Energy, Metals"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      badge={badge}
      headerRight={headerRight}
      skeletonRows={6}
    >
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs text-slate-400 w-28 truncate group-hover:text-slate-300 transition-colors">
              {item.label}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-medium text-slate-100 tabular-nums">
                {item.prefix}
                {item.value.toLocaleString('en-US', {
                  minimumFractionDigits: item.value < 10 ? 3 : 2,
                  maximumFractionDigits: item.value < 10 ? 3 : 2,
                })}
              </span>
              <div className="w-20 text-right">
                <ChangeIndicator value={item.changePct} suffix="%" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}
