import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from "recharts";

// 1. Accept startIndex and endIndex as props
export default function GlobalNetworkChart({ data, syncId, startIndex, endIndex, onBrushChange }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} syncId={syncId} margin={{ left: -20, right: 10, top: 5, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        <YAxis stroke="#737373" fontSize={11} tickFormatter={(val) => `${val}GB/s`} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "5px", paddingBottom: "10px" }} />
        
        <Line type="stepAfter" name="Heavy Nodes Bandwidth" dataKey="heavyBandwidth" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line type="stepAfter" name="Dev Nodes Bandwidth" dataKey="devBandwidth" stroke="#14b8a6" strokeWidth={2} dot={false} strokeDasharray="3 3" />

        {/* 2. Bind the UI to the React state */}
        <Brush 
          dataKey="time" 
          height={30} 
          stroke="#4f46e5" 
          fill="#171717"
          tickFormatter={() => ""} 
          startIndex={startIndex}
          endIndex={endIndex}
          onChange={onBrushChange} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}