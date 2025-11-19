
import React from 'react';
import { ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Bar, Cell } from 'recharts';
import { CandleData } from '../types';

interface CandleChartProps {
  data: CandleData[];
}

const CustomCandleShape = (props: any) => {
  const { x, y, width, height, payload, min, max } = props;
  const { open, close, high, low } = payload;
  
  const isUp = close >= open;
  const color = isUp ? '#10b981' : '#ef4444'; // success : danger

  // Calculate positions based on the YAxis scale logic of Recharts
  // We can approximate the ratio if we don't have direct access to the scale function here easily,
  // but Recharts passes `y` and `height` for the BAR part (which is usually Open-Close).
  // However, to draw the wick correctly relative to the bar, we need to map values.
  
  // A simpler trick with Recharts for candles:
  // The "Bar" dataKey is usually the top/bottom of the body. 
  // But customizing it fully requires knowing the pixel conversion.
  
  // Instead, we rely on the props provided by Recharts to the shape.
  // x: x-position of the bar
  // width: width of the bar
  // For Y, Recharts gives us the position of the value specified in dataKey.
  
  // Let's try a different approach: The standard Recharts candle trick involves 
  // using error bars or computing pixel values.
  // Given the complexity of re-calculating scales inside a custom shape without the scale function,
  // we will use the props `y` and `height` which represent the body (Open to Close) if we set the dataKey correctly.
  
  // However, passing 'open' and 'close' as array to dataKey isn't supported in basic Bar.
  // So we calculate pixels manually based on the max/min of the axis passed in `viewBox` or similar if available? No.
  
  // BEST APPROACH FOR RECHARTS CANDLES:
  // Use the Axis Scale passed in the `yAxis` context? Hard to access.
  // We will use the `y` (top of bar) and `height` (height of bar) provided by Recharts for the body.
  // We assume the Bar dataKey is `[min(open, close), max(open, close)]`. 
  
  // Actually, let's simplify. We will assume the user passed `low` and `high` to an ErrorBar? 
  // No, that's ugly.
  
  // We will use the "y" and "height" prop provided by the Bar.
  // But we need the wick.
  // We can't easily get the pixel coordinates for high/low without the scale.
  
  // ALTERNATIVE: We render SVG paths directly if we can get the scale.
  // Recharts passes `yAxis` prop to the custom shape if we are lucky?
  // Yes, `yAxis` is in props. It has a scale function.
  
  const { yAxis } = props;
  const scale = yAxis.scale;
  
  const yOpen = scale(open);
  const yClose = scale(close);
  const yHigh = scale(high);
  const yLow = scale(low);
  
  const bodyTop = Math.min(yOpen, yClose);
  const bodyHeight = Math.abs(yOpen - yClose);
  const effectiveBodyHeight = bodyHeight < 1 ? 1 : bodyHeight; // Ensure line is visible if flat

  const wickX = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line 
        x1={wickX} 
        y1={yHigh} 
        x2={wickX} 
        y2={yLow} 
        stroke={color} 
        strokeWidth={1} 
      />
      {/* Body */}
      <rect 
        x={x} 
        y={bodyTop} 
        width={width} 
        height={effectiveBodyHeight} 
        fill={color} 
        stroke="none"
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    return (
      <div className="bg-[#18181b] border border-zinc-700 p-2 rounded text-xs shadow-xl font-mono">
        <p className="text-zinc-400 mb-1">{label}</p>
        <div className="space-y-0.5">
          <p><span className="text-zinc-500">O:</span> <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{data.open}</span></p>
          <p><span className="text-zinc-500">H:</span> <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{data.high}</span></p>
          <p><span className="text-zinc-500">L:</span> <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{data.low}</span></p>
          <p><span className="text-zinc-500">C:</span> <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{data.close}</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const CandleChart: React.FC<CandleChartProps> = ({ data }) => {
  // Calculate domain with some padding
  const allLows = data.map(d => d.low);
  const allHighs = data.map(d => d.high);
  const minPrice = Math.min(...allLows);
  const maxPrice = Math.max(...allHighs);
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="w-full h-full min-h-0 min-w-0 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="time" 
            hide={true}
          />
          <YAxis 
            domain={[minPrice - padding, maxPrice + padding]} 
            orientation="right" 
            tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickFormatter={(val) => val.toFixed(2)}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeDasharray: '4 4' }} />
          <Bar 
            dataKey="close" // Key needed for tooltips/hover, but shape handles drawing
            shape={<CustomCandleShape />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CandleChart;
