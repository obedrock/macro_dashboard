import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { WidgetId, TimeSeriesPoint } from '../../types';
import { MarketData } from '../../types';
import {
  rateHistorySeries,
  sp500Series,
  dxySeries,
  wtiSeries,
  mockMarketData,
} from '../../data/mockData';

interface Props {
  widgetId: WidgetId;
  data: MarketData;
  onClose: () => void;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

const WIDGET_TITLES: Record<WidgetId, string> = {
  yields: 'Yield Curve',
  rates: '10Y Treasury Yield',
  equities: 'S&P 500',
  fx: 'DXY Index',
  commodities: 'WTI Crude Oil',
  credit: 'HY OAS Credit Spread',
  inflation: 'CPI Year-over-Year',
  calendar: 'Economic Calendar',
  fedwatch: 'Fed Funds Rate',
  news: 'Macro News',
};

function getSeriesForWidget(id: WidgetId): TimeSeriesPoint[] {
  switch (id) {
    case 'rates': return rateHistorySeries;
    case 'equities': return sp500Series;
    case 'fx': return dxySeries;
    case 'commodities': return wtiSeries;
    case 'credit': return mockMarketData.credit[0].series;
    case 'inflation': return mockMarketData.inflation[0].series;
    case 'yields': return rateHistorySeries;
    case 'fedwatch': return rateHistorySeries;
    default: return sp500Series;
  }
}

function filterByRange(series: TimeSeriesPoint[], range: TimeRange): TimeSeriesPoint[] {
  const now = new Date();
  let days: number;
  switch (range) {
    case '1D': days = 1; break;
    case '1W': days = 7; break;
    case '1M': days = 30; break;
    case '3M': days = 90; break;
    case '1Y': days = 365; break;
    case '5Y': days = 1825; break;
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return series.filter(p => new Date(p.date) >= cutoff);
}

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

export default function ExpandedModal({ widgetId, data, onClose }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const allSeries = getSeriesForWidget(widgetId);
  const filtered = filterByRange(allSeries, timeRange);

  const title = WIDGET_TITLES[widgetId];
  const lastVal = filtered[filtered.length - 1]?.value ?? 0;
  const firstVal = filtered[0]?.value ?? 0;
  const change = lastVal - firstVal;
  const changePct = firstVal !== 0 ? (change / firstVal) * 100 : 0;
  const isPositive = change >= 0;
  const minVal = Math.min(...filtered.map(d => d.value));
  const maxVal = Math.max(...filtered.map(d => d.value));

  const gradientId = `grad-${widgetId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xl font-mono font-bold text-slate-100">
                  {lastVal.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                </span>
                <span
                  className={`text-sm font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {isPositive ? '+' : ''}{change.toFixed(3)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-sm font-mono rounded-lg transition-all ${
                timeRange === r
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? '#34d399' : '#f87171'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? '#34d399' : '#f87171'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={v => {
                  const d = new Date(v);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                domain={[minVal * 0.995, maxVal * 1.005]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v.toFixed(2)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#cbd5e1',
                }}
                labelFormatter={v => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                formatter={(val: unknown) => [(val as number).toFixed(3), title]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#34d399' : '#f87171'}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: isPositive ? '#34d399' : '#f87171' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="px-6 pb-4 flex items-center gap-6 border-t border-slate-800 pt-3">
          <div className="text-center">
            <div className="text-xs text-slate-500">High</div>
            <div className="text-sm font-mono text-slate-200">{maxVal.toFixed(3)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Low</div>
            <div className="text-sm font-mono text-slate-200">{minVal.toFixed(3)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500">Range</div>
            <div className="text-sm font-mono text-slate-200">{(maxVal - minVal).toFixed(3)}</div>
          </div>
          <div className="text-center ml-auto">
            <div className="text-xs text-slate-500">Period Change</div>
            <div className={`text-sm font-mono font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{changePct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
