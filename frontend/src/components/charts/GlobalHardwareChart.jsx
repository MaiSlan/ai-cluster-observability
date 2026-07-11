import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function GlobalHardwareChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} syncId={syncId} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        <YAxis stroke="#737373" fontSize={11} domain={["auto", "auto"]} tickFormatter={(val) => `${val}°C`} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />

        <Line type="monotone" name="Heavy Workload Temp" dataKey="heavyTemp" stroke="#f97316" strokeWidth={2} dot={false} />
        <Line type="monotone" name="Dev Workload Temp" dataKey="devTemp" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}