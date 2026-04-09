import React from 'react';
import { ExternalLink } from 'lucide-react';
import Widget from '../shared/Widget';
import { NewsItem, WidgetStatus } from '../../types';

interface Props {
  news: NewsItem[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

const SENTIMENT_CONFIG = {
  positive: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  negative: { dot: 'bg-red-400', text: 'text-red-400' },
  neutral: { dot: 'bg-slate-500', text: 'text-slate-500' },
};

export default function NewsWidget({ news, onExpand, onRetry, dragHandleProps, status }: Props) {
  return (
    <Widget
      title="Macro News"
      subtitle="Recent headlines"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={8}
    >
      <div className="space-y-0 divide-y divide-slate-800/70">
        {news.map(item => {
          const config = SENTIMENT_CONFIG[item.sentiment];
          return (
            <div
              key={item.id}
              className="py-3 group hover:bg-slate-800/30 px-2 -mx-2 rounded transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 leading-snug group-hover:text-slate-100 transition-colors">
                    {item.headline}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500">{item.source}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-600">{item.time}</span>
                  </div>
                </div>
                <a
                  href={item.url}
                  className="flex-shrink-0 p-1 text-slate-700 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-2 border-t border-slate-800 text-center">
        <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Load more headlines
        </button>
      </div>
    </Widget>
  );
}
