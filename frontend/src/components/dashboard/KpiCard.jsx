export default function KpiCard({ title, value, icon: Icon, alert = false, color = "blue" }) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10",
    orange: "text-orange-400 bg-orange-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    red: "text-red-400 bg-red-500/10",
  };

  const iconStyle = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-neutral-900 border ${alert ? 'border-red-500/50' : 'border-neutral-800'} rounded-xl p-6 relative overflow-hidden transition-colors`}>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconStyle}`}>
            <Icon size={20} />
          </div>
          <h2 className="text-sm font-medium text-neutral-400">{title}</h2>
        </div>
      </div>
      
      <p className={`text-4xl font-light relative z-10 ${alert ? 'text-red-400' : 'text-neutral-50'}`}>
        {value}
      </p>
      
      {/* Background Watermark Icon */}
      <div className={`absolute -bottom-4 -right-4 opacity-5 ${alert ? 'text-red-500' : 'text-white'}`}>
        <Icon size={100} />
      </div>
    </div>
  );
}