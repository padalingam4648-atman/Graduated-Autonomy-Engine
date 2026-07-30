import { Bell, Settings as SettingsIcon } from "lucide-react";
import { useLocation } from "react-router-dom";

export function TopNav() {
  const location = useLocation();
  const pageTitle = {
    "/dashboard": "Governance Dashboard",
    "/query": "Query Writer",
    "/audit": "Audit Repository",
    "/settings": "Platform Settings"
  }[location.pathname] || "";

  return (
    <header className="app-header">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
      <div className="flex items-center gap-4">
        <button className="btn-icon" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <button className="btn-icon" aria-label="Settings">
          <SettingsIcon size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm ml-2">
          AD
        </div>
      </div>
    </header>
  );
}
