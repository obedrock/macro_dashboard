import React, { useState, useEffect } from 'react';
import Widget from '../shared/Widget';
import { FomcMeeting, WidgetStatus } from '../../types';

interface Props {
  nextMeeting: string;
  currentRate: string;
  meetings: FomcMeeting[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
}

function getDaysUntil(dateStr: string): number {
  const match = dateStr.match(/([A-Za-z]+)\s+(\d+)[^,]*,\s*(\d{4})/);
  if (!match) return 0;
  const d = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

const RATE_COLORS: Record<string, string> = {
  cut: 'bg-emerald-400',
  hold: 'bg-sky-400',
  hike: 'bg-red-400',
};

function getRateType(rate: string, currentRate: string): 'cut' | 'hold' | 'hike' {
  const [lo] = rate.split('–').map(s => parseFloat(s));
  const [cLo] = currentRate.split('–').map(s => parseFloat(s));
  if (lo < cLo) return 'cut';
  if (lo > cLo) return 'hike';
  return 'hold';
}

export default function FedWatchWidget({
  nextMeeting,
  currentRate,
  meetings,
  onExpand,
  onRetry,
  dragHandleProps,
  status,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const meeting = meetings[activeIdx];
  const daysUntil = getDaysUntil(nextMeeting);
  const topProb = [...meeting.probabilities].sort((a, b) => b.probability - a.probability)[0];

  return (
    <Widget
      title="Fed Watch"
      subtitle="CME Implied Probabilities"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      skeletonRows={4}
    >
      <div className="mb-4 p-3 bg-slate-800/60 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Current Rate</div>
          <div className="text-lg font-mono font-bold text-slate-100">{currentRate}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Next FOMC</div>
          <div className="text-sm font-mono font-semibold text-amber-400">{nextMeeting}</div>
          <div className="text-xs text-slate-600">{daysUntil} days away</div>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {meetings.map((m, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`flex-1 py-1 text-xs rounded font-mono transition-all truncate ${
              activeIdx === i
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
            }`}
          >
            {i === 0 ? 'Next' : i === 1 ? '+2nd' : '+3rd'}
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-500 mb-3 font-mono">{meeting.date}</div>

      <div className="space-y-2.5">
        {meeting.probabilities.map(prob => {
          const type = getRateType(prob.rate, currentRate);
          return (
            <div key={prob.rate}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      type === 'cut'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : type === 'hike'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {type}
                  </span>
                  <span className="text-xs font-mono text-slate-300">{prob.rate}%</span>
                </div>
                <span className="text-sm font-mono font-bold text-slate-100">{prob.probability}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    type === 'cut'
                      ? 'bg-emerald-400'
                      : type === 'hike'
                      ? 'bg-red-400'
                      : 'bg-sky-400'
                  }`}
                  style={{ width: `${prob.probability}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Most likely outcome</span>
          <span
            className={`text-xs font-mono font-semibold ${
              getRateType(topProb.rate, currentRate) === 'cut'
                ? 'text-emerald-400'
                : getRateType(topProb.rate, currentRate) === 'hike'
                ? 'text-red-400'
                : 'text-sky-400'
            }`}
          >
            {topProb.rate}% — {topProb.probability}%
          </span>
        </div>
      </div>
    </Widget>
  );
}
