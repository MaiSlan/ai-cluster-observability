import { NavLink } from "react-router-dom";
import { LayoutDashboard, Server, Activity, Settings } from "lucide-react";

export default function Sidebar() {
  const navItems = [
    { name: "Overview", path: "/", icon: LayoutDashboard },
    { name: "Node Directory", path: "/nodes", icon: Server },
    { name: "Live Telemetry", path: "/telemetry", icon: Activity },
  ];

  return (
    <aside className="w-64 h-screen bg-neutral-900 border-r border-neutral-800 flex flex-col fixed left-0 top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-800">
        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse mr-3"></div>
        <span className="font-semibold text-lg tracking-tight text-neutral-100">OpsCenter</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-4 space-y-1">
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

      {/* Settings / Footer */}
      <div className="p-4 border-t border-neutral-800">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-sm font-medium text-neutral-400 hover:bg-neutral-800/50 transition-colors">
          <Settings size={18} />
          Cluster Config
        </button>
      </div>
    </aside>
  );
}