import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function NetworkChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} syncId={syncId} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        <YAxis stroke="#737373" fontSize={11} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        
        <Line type="stepAfter" name="Bus Bandwidth" dataKey="bandwidth" stroke="#10b981" strokeWidth={1.5} dot={false} />
        <Line type="monotone" name="Network Delay (us)" dataKey="networkDelay" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}