import { Search, Bell } from "lucide-react";

export function TopNav() {
  return (
    <header className="app-header bg-white border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Global Search Bar */}
      <div className="relative w-72 md:w-96">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full pl-10 pr-12 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white text-slate-400 border border-slate-200 shadow-2xs">
          ⌘K
        </kbd>
      </div>

      {/* Right Quick Actions & Badges */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
