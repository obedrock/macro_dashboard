import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import Widget from '../shared/Widget';
import { EconomicEvent, WidgetStatus } from '../../types';

interface Props {
  events: EconomicEvent[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
}

function getCountdown(dateStr: string, timeStr: string): string {
  try {
    const [hour, rest] = timeStr.split(':');
    const [min, period] = rest.split(' ');
    let h = parseInt(hour, 10);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    const target = new Date(dateStr);
    target.setHours(h, parseInt(min, 10), 0, 0);

    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff < 0) return 'Released';

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  } catch {
    return '--';
  }
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d >= now && d <= weekEnd;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

const IMPORTANCE_COLORS = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-600',
};

export default function EconomicCalendar({ events, onExpand, onRetry, dragHandleProps, status, badge, headerRight }: Props) {
  const [, setTick] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const nextHighEvent = events.find(e => e.importance === 'high');
  const displayEvents = showAll ? events : events.slice(0, 8);

  return (
    <Widget
      title="Economic Calendar"
      subtitle="Upcoming releases"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      badge={badge}
      headerRight={headerRight}
      skeletonRows={8}
    >
      {nextHighEvent && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-amber-400">{nextHighEvent.name}</div>
              <div className="text-xs text-slate-500">{nextHighEvent.date} · {nextHighEvent.time}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-amber-400">
              {getCountdown(nextHighEvent.date, nextHighEvent.time)}
            </div>
            <div className="text-xs text-slate-600">countdown</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-600 border-b border-slate-800">
              <th className="text-left pb-2 pr-2 font-medium w-4"></th>
              <th className="text-left pb-2 pr-3 font-medium">Event</th>
              <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Date</th>
              <th className="text-right pb-2 pr-3 font-medium hidden md:table-cell">Prev</th>
              <th className="text-right pb-2 pr-3 font-medium hidden md:table-cell">Est</th>
              <th className="text-right pb-2 font-medium hidden lg:table-cell">In</th>
            </tr>
          </thead>
          <tbody>
            {displayEvents.map(event => {
              const today = isToday(event.date);
              const thisWeek = isThisWeek(event.date);
              return (
                <tr
                  key={event.id}
                  className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/50 ${
                    today ? 'bg-sky-500/5' : ''
                  }`}
                >
                  <td className="py-2 pr-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${IMPORTANCE_COLORS[event.importance]}`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`${
                          today
                            ? 'text-sky-400 font-medium'
                            : thisWeek
                            ? 'text-slate-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {event.name}
                      </span>
                      {today && (
                        <span className="text-xs px-1 py-0.5 bg-sky-500/20 text-sky-400 rounded font-mono">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 text-xs sm:hidden">{event.date}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-500 hidden sm:table-cell">
                    <div>{event.date}</div>
                    <div className="text-slate-600">{event.time}</div>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-500 hidden md:table-cell">
                    {event.previous}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-300 hidden md:table-cell">
                    {event.consensus}
                  </td>
                  <td className="py-2 text-right font-mono text-amber-400/80 hidden lg:table-cell whitespace-nowrap">
                    {getCountdown(event.date, event.time)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {events.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-xs text-slate-500 hover:text-slate-300 transition-colors text-center py-1"
        >
          {showAll ? 'Show less' : `Show ${events.length - 8} more releases`}
        </button>
      )}

      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          High impact
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Medium
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          Low
        </div>
      </div>
    </Widget>
  );
}
