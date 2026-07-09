import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function HardwareChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} syncId={syncId} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" hide />
        
        {/* Left Axis: Optimized for 0-100 scale (Celsius and Percentage) */}
        <YAxis 
          yAxisId="left" 
          stroke="#737373" 
          fontSize={11} 
          domain={["auto", "auto"]} 
        />
        
        {/* Right Axis: Optimized for high-number scales (Watts) */}
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          stroke="#737373" 
          fontSize={11} 
        />
        
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "5px" }} />

        {/* The Three Hardware Metrics */}
        <Line 
          yAxisId="left" 
          type="monotone" 
          name="Avg Temp (°C)" 
          dataKey="temperature" 
          stroke="#f97316" 
          strokeWidth={1.5} 
          dot={false} 
        />
        <Line 
          yAxisId="left" 
          type="monotone" 
          name="Avg Utilization (%)" 
          dataKey="utilization" 
          stroke="#3b82f6" 
          strokeWidth={1.5} 
          dot={false} 
        />
        <Line 
          yAxisId="right" 
          type="monotone" 
          name="Total Power (W)" 
          dataKey="powerDraw" 
          stroke="#ef4444" 
          strokeWidth={1.5} 
          dot={false} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}