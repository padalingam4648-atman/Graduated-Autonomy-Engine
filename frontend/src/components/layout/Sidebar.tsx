import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Code,
  ShieldCheck,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Database,
  Cpu,
  Lock,
  Server,
} from "lucide-react";
import clsx from "clsx";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/query", label: "Query Writer", icon: Code },
    { to: "/audit", label: "Audit Logs", icon: ShieldCheck },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside
      className={clsx(
        "app-sidebar bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 transition-all duration-300 z-30 select-none",
        isCollapsed ? "w-20 px-3 py-4" : "w-[260px] p-5"
      )}
    >
      <div className="space-y-6">
        {/* Brand Header */}
        <div className={clsx("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white font-bold text-xl shadow-md shadow-emerald-500/20 shrink-0">
            <Shield size={22} className="text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
          </div>

          {!isCollapsed && (
            <div className="overflow-hidden">
              <span className="font-bold text-base tracking-tight text-slate-900 block leading-snug truncate">
                Autonomy Engine
              </span>
              <span className="text-[11px] font-medium text-slate-400 block truncate">
                AI Database Governance
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5 pt-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              title={isCollapsed ? link.label : undefined}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 group",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-emerald-50 text-emerald-700 font-semibold border-r-2 border-emerald-600 shadow-xs"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )
              }
            >
              <link.icon
                size={20}
                className="group-hover:scale-105 transition-transform shrink-0"
              />
              {!isCollapsed && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* System Status Section (Expanded only) */}
        {!isCollapsed && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-1 font-mono">
              System Status
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Cpu size={14} className="text-slate-400" /> Groq AI
                </span>
                <span className="font-semibold text-emerald-600">Online</span>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Database size={14} className="text-slate-400" /> MySQL Database
                </span>
                <span className="font-semibold text-emerald-600">Connected</span>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Lock size={14} className="text-slate-400" /> Audit Repository
                </span>
                <span className="font-semibold text-emerald-600">Healthy</span>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Server size={14} className="text-slate-400" /> Backend API
                </span>
                <span className="font-semibold text-emerald-600">Online</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Footer & Collapse Toggle */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                AD
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-800 truncate">Administrator</div>
                <div className="text-[10px] text-slate-400 truncate">Database Admin</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
              AD
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className={clsx(
            "w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer",
            isCollapsed && "justify-center px-0"
          )}
        >
          {isCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
