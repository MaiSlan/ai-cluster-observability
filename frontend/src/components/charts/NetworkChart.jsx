import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from "recharts";

export default function NetworkChart({ data, syncId, onBrushChange }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* Increased bottom margin from 5 to 20 to make room for the brush */}
      <LineChart data={data} syncId={syncId} margin={{ left: -10, right: 10, top: 5, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        <YAxis stroke="#737373" fontSize={11} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        
        <Line type="stepAfter" name="Bus Bandwidth" dataKey="bandwidth" stroke="#10b981" strokeWidth={1.5} dot={false} />
        <Line type="monotone" name="Network Delay (us)" dataKey="networkDelay" stroke="#f59e0b" strokeWidth={1.5} dot={false} />

        {/* THE AI BRUSH CONTROLLER */}
        <Brush 
          dataKey="time" 
          height={30} 
          stroke="#4f46e5" /* Indigo color to match the Ask AI button */
          fill="#171717"
          tickFormatter={() => ""} /* Hides the redundant text inside the slider */
          onChange={onBrushChange} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}