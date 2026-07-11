import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function InferenceChart({ data, syncId }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* Increased bottom margin from 5 to 20 for X-axis labels */}
      <AreaChart data={data} syncId={syncId} margin={{ left: -10, right: 10, top: 5, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        
        {/* UN-HIDDEN X-AXIS */}
        <XAxis dataKey="time" stroke="#525252" fontSize={11} tickMargin={6} />
        
        <YAxis stroke="#737373" fontSize={11} />
        <Tooltip contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "6px" }} />
        
        <Area type="monotone" dataKey="tps" name="Aggregate TPS" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={1.5} />
        <Area type="monotone" dataKey="queue" name="Requests Waiting" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}