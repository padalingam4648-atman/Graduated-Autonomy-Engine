import { NavLink } from "react-router-dom";
import { LayoutDashboard, TerminalSquare, ShieldCheck, Settings } from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/query", label: "Query Writer", icon: TerminalSquare },
    { to: "/audit", label: "Audit Logs", icon: ShieldCheck },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="app-sidebar">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[var(--border-light)]">
        <div className="w-8 h-8 rounded bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-xl">
          ⬡
        </div>
        <span className="font-bold text-lg tracking-tight">Autonomy Engine</span>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => clsx("nav-item", isActive && "active")}
          >
            <link.icon size={20} />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
