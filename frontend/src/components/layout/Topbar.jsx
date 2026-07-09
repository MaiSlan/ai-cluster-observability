import { Bell, Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 bg-neutral-950/50 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 w-64">
        <Search size={16} className="mr-2" />
        <input 
          type="text" 
          placeholder="Search node or GPU ID..." 
          className="bg-transparent border-none outline-none text-sm w-full text-neutral-200 placeholder-neutral-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="text-neutral-400 hover:text-neutral-200 transition-colors">
          <Bell size={18} />
        </button>
        <div className="h-8 w-px bg-neutral-800"></div>
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <div className="text-sm font-medium text-neutral-200 group-hover:text-white">Admin: Basile H.</div>
            <div className="text-xs text-neutral-500">Lead Infrastructure</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-semibold">
            BH
          </div>
        </div>
      </div>
    </header>
  );
}