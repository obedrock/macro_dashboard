import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import Widget from '../shared/Widget';
import { YieldCurveData, WidgetStatus } from '../../types';

interface Props {
  data: YieldCurveData[];
  onExpand?: () => void;
  onRetry?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  status?: WidgetStatus;
  badge?: React.ReactNode;
  freshnessNode?: React.ReactNode;
}

type Overlay = 'none' | '1m' | '1y';

export default function YieldCurveChart({ data, onExpand, onRetry, dragHandleProps, status, badge, freshnessNode }: Props) {
  const [overlay, setOverlay] = useState<Overlay>('1m');

  // Compute Y-axis domain from actual data with tight padding
  const allValues = data.flatMap(d => [d.current, d.oneMonthAgo, d.oneYearAgo]).filter(v => v > 0);
  const minY = allValues.length > 0 ? Math.floor(Math.min(...allValues) * 4) / 4 : 3;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) * 4) / 4 + 0.25 : 5;

  // Compute spreads from actual data
  const getRate = (maturity: string) => data.find(d => d.maturity === maturity)?.current ?? 0;
  const y2 = getRate('2Y');
  const y3m = getRate('3M');
  const y10 = getRate('10Y');
  const y30 = getRate('30Y');
  const spread2s10s = y2 && y10 ? ((y10 - y2) * 100).toFixed(1) : null;
  const spread2s30s = y2 && y30 ? ((y30 - y2) * 100).toFixed(1) : null;
  const spread3m10y = y3m && y10 ? ((y10 - y3m) * 100).toFixed(1) : null;

  // Fed funds rate approximation from 1M yield (upper target ≈ ceil to nearest 0.25)
  const y1m = getRate('1M');
  const fedFundsApprox = y1m > 0 ? Math.ceil((y1m + 0.08) * 4) / 4 : null;

  return (
    <Widget
      title="Yield Curve"
      subtitle="US Treasury"
      onExpand={onExpand}
      onRetry={onRetry}
      dragHandleProps={dragHandleProps}
      status={status}
      badge={badge}
      skeletonRows={4}
      headerRight={
        <div className="flex items-center gap-2">
          {freshnessNode}
          <div className="flex gap-1">
            {(['none', '1m', '1y'] as Overlay[]).map(o => (
              <button
                key={o}
                onClick={() => setOverlay(o)}
                className={`text-xs px-2 py-0.5 rounded font-mono transition-all ${
                  overlay === o
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {o === 'none' ? 'Today' : o === '1m' ? '+1M ago' : '+1Y ago'}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 10, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="maturity"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis
              domain={[minY, maxY]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v.toFixed(2)}%`}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#cbd5e1',
              }}
              formatter={(val: unknown, name: unknown) => [`${(val as number).toFixed(3)}%`, name as string]}
            />
            {fedFundsApprox !== null && (
              <ReferenceLine
                y={fedFundsApprox}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: `Fed Funds ${fedFundsApprox.toFixed(2)}%`, fill: '#f59e0b', fontSize: 9, position: 'insideRight' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="current"
              name="Current"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ fill: '#38bdf8', r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            {(overlay === '1m' || overlay === '1y') && (
              <Line
                type="monotone"
                dataKey="oneMonthAgo"
                name="1M ago"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {overlay === '1y' && (
              <Line
                type="monotone"
                dataKey="oneYearAgo"
                name="1Y ago"
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 px-1">
        {spread2s10s !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">2s10s:</span>
            <span className={`text-xs font-mono ${parseFloat(spread2s10s) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(spread2s10s) >= 0 ? '+' : ''}{spread2s10s} bps
            </span>
          </div>
        )}
        {spread2s30s !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">2s30s:</span>
            <span className={`text-xs font-mono ${parseFloat(spread2s30s) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(spread2s30s) >= 0 ? '+' : ''}{spread2s30s} bps
            </span>
          </div>
        )}
        {spread3m10y !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">3m10y:</span>
            <span className={`text-xs font-mono ${parseFloat(spread3m10y) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(spread3m10y) >= 0 ? '+' : ''}{spread3m10y} bps
            </span>
          </div>
        )}
      </div>
    </Widget>
  );
}
