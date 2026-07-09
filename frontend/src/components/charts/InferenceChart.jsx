import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function InferenceChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} syncId={syncId} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        <XAxis dataKey="time" hide />
        <YAxis stroke="#737373" fontSize={11} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        
        {/* We use an Area chart here because throughput and queues represent volume */}
        <Area type="monotone" dataKey="tps" name="Aggregate TPS" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={1.5} />
        <Area type="monotone" dataKey="queue" name="Requests Waiting" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}