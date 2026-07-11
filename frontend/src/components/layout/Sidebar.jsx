import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Server, Activity, Settings, Bell, AlertTriangle, CheckCircle2, X } from "lucide-react";

export default function Sidebar() {
  const [alerts, setAlerts] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // The Pub/Sub Listener: Catches the custom event dispatched by the Threat Engine
  useEffect(() => {
    const handleAlert = (e) => {
      // Prepend the new alert to the top of the list
      setAlerts((prev) => [e.detail, ...prev]);
    };
    
    window.addEventListener('ai-cluster-alert', handleAlert);
    return () => window.removeEventListener('ai-cluster-alert', handleAlert);
  }, []);

  const clearAlerts = () => {
    setAlerts([]);
    setIsDropdownOpen(false);
  };

  const navItems = [
    { name: "Overview", path: "/", icon: LayoutDashboard },
    { name: "Node Directory", path: "/nodes", icon: Server },
    { name: "Live Telemetry", path: "/telemetry", icon: Activity },
  ];

  return (
    <aside className="w-64 h-screen bg-neutral-900 border-r border-neutral-800 flex flex-col fixed left-0 top-0 z-40">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-800 shrink-0">
        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse mr-3 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        <span className="font-semibold text-lg tracking-tight text-neutral-100">OpsCenter</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`
              }
            >
              <Icon size={18} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Controls (Settings, Alerts, Profile) */}
      <div className="p-4 border-t border-neutral-800 flex flex-col gap-2 shrink-0 relative">
        
        <button className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-sm font-medium text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors">
          <Settings size={18} />
          Cluster Config
        </button>

        {/* The Notification Bell Trigger */}
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
          className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-sm font-medium transition-colors ${isDropdownOpen ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'}`}
        >
          <div className="relative">
            <Bell size={18} />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-neutral-900 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
          </div>
          Active Alerts
          {alerts.length > 0 && (
            <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {alerts.length}
            </span>
          )}
        </button>

        {/* The Floating Alerts Popover */}
        {isDropdownOpen && (
          <div className="absolute left-full bottom-16 ml-2 w-80 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[400px]">
            <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-950/50">
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" /> System Alerts
              </h3>
              <button onClick={() => setIsDropdownOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-neutral-500 gap-2">
                  <CheckCircle2 size={32} className="text-emerald-500/50" />
                  <p className="text-sm">All systems nominal</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-neutral-800">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="p-3 hover:bg-neutral-800/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-red-400">{alert.node}</span>
                        <span className="text-[10px] text-neutral-500">{alert.time}</span>
                      </div>
                      <p className="text-xs text-neutral-300">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {alerts.length > 0 && (
              <div className="p-2 border-t border-neutral-800 bg-neutral-950/50">
                <button onClick={clearAlerts} className="w-full py-1.5 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800">
                  Dismiss All
                </button>
              </div>
            )}
          </div>
        )}

        {/* User Profile Component */}
        <div className="flex items-center gap-3 mt-2 pt-4 border-t border-neutral-800 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-semibold shrink-0">
            BH
          </div>
          <div className="text-left overflow-hidden">
            <div className="text-sm font-medium text-neutral-200 group-hover:text-white truncate transition-colors">Admin: Basile H.</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider truncate">Lead Infrastructure</div>
          </div>
        </div>

      </div>
    </aside>
  );
}