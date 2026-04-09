import React from 'react';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import { TimeSeriesPoint } from '../../types';

interface Props {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
}

export default function SparklineChart({ data, color = '#38bdf8', height = 40 }: Props) {
  const trend = data.length > 1 ? data[data.length - 1].value - data[0].value : 0;
  const lineColor = trend >= 0 ? '#34d399' : '#f87171';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color || lineColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{
            background: '#1e2a3a',
            border: '1px solid #334155',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#cbd5e1',
          }}
          formatter={(val: unknown) => [(val as number).toFixed(2), '']}
          labelFormatter={(label: unknown) => String(label)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
