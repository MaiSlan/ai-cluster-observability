export default function KpiCard({ title, value, icon: Icon, alert = false, color = "blue" }) {
  // Added indigo to support the network card
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10",
    orange: "text-orange-400 bg-orange-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    red: "text-red-400 bg-red-500/10",
    indigo: "text-indigo-400 bg-indigo-500/10",
  };

  const iconStyle = colorMap[color] || colorMap.blue;

  return (
    // Reduced padding from p-6 to p-4 for the denser 5-column layout
    <div className={`bg-neutral-900 border ${alert ? 'border-red-500/50' : 'border-neutral-800'} rounded-xl p-4 relative overflow-hidden transition-colors`}>
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2">
          {/* Slightly smaller icon container */}
          <div className={`p-1.5 rounded-lg ${iconStyle}`}>
            <Icon size={16} />
          </div>
          <h2 className="text-xs font-medium text-neutral-400">{title}</h2>
        </div>
      </div>
      
      {/* Reduced text size from text-4xl to text-2xl */}
      <p className={`text-2xl font-semibold relative z-10 ${alert ? 'text-red-400' : 'text-neutral-50'}`}>
        {value}
      </p>
      
      {/* Background Watermark Icon - scaled down slightly */}
      <div className={`absolute -bottom-2 -right-2 opacity-[0.03] ${alert ? 'text-red-500' : 'text-white'}`}>
        <Icon size={80} />
      </div>
    </div>
  );
}