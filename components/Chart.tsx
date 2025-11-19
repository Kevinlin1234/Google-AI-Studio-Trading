import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MarketData } from '../types';

interface ChartProps {
  data: MarketData;
}

const Chart: React.FC<ChartProps> = ({ data }) => {
  const isPositive = data.change24h >= 0;
  const color = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="w-full h-full min-h-0 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.history}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            domain={['auto', 'auto']} 
            orientation="right" 
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickFormatter={(val) => `$${val.toLocaleString()}`}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#e4e4e7' }}
            itemStyle={{ color: color }}
            formatter={(value: number) => [`$${value.toFixed(data.symbol === 'DOGE' ? 5 : 2)}`, 'Price']}
            labelStyle={{ display: 'none' }}
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;