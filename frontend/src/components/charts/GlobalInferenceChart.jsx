import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function GlobalInferenceChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} syncId={syncId} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        <YAxis stroke="#737373" fontSize={11} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
        
        <Area type="monotone" dataKey="heavyTps" name="Heavy Nodes TPS" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} strokeWidth={2} />
        <Area type="monotone" dataKey="devTps" name="Dev Nodes TPS" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}