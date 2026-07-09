import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush // <-- New Import
} from 'recharts';

export default function GlobalChart({ data, startIndex, endIndex, onBrushChange }) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-500">
        No time-series data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        
        <XAxis 
          dataKey="time" 
          stroke="#737373" 
          fontSize={12} 
          tickMargin={10}
          minTickGap={30}
        />
        
        <YAxis 
          yAxisId="left" 
          stroke="#f97316" 
          fontSize={12}
          tickFormatter={(val) => `${val}°C`}
          domain={['dataMin - 5', 'dataMax + 5']}
        />
        
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          stroke="#a855f7" 
          fontSize={12}
          domain={[0, 'auto']}
        />
        
        <Tooltip 
          contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
          itemStyle={{ fontSize: '14px' }}
          labelStyle={{ color: '#a3a3a3', marginBottom: '4px' }}
        />
        
        <Legend wrapperStyle={{ paddingTop: '10px' }} />

        <Line 
          yAxisId="left"
          type="monotone" 
          name="Avg Temperature"
          dataKey="avgTemp" 
          stroke="#f97316" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
        />
        
        <Line 
          yAxisId="right"
          type="monotone" 
          name="Aggregate TPS"
          dataKey="tps" 
          stroke="#a855f7" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
        />

        {/* The Interactive Mini-Map Slider */}
        <Brush 
          dataKey="time" 
          height={30} 
          stroke="#525252" 
          fill="#171717"
          tickFormatter={() => ''}
          startIndex={startIndex}
          endIndex={endIndex}
          onChange={onBrushChange}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}