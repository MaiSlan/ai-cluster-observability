import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";

export default function StatusBadge({ status }) {
  const config = {
    online: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
    warning: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle },
    offline: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
    processing: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Activity },
  };

  const style = config[status?.toLowerCase()] || config.offline;
  const Icon = style.icon;

  return (
    <div className={`flex items-center gap-2 text-sm w-max px-2.5 py-1 rounded-full border ${style.color} ${style.bg} ${style.border}`}>
      <Icon size={14} />
      <span className="capitalize font-medium">{status || "Unknown"}</span>
    </div>
  );
}