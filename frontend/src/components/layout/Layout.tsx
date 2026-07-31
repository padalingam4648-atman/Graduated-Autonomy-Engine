import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { useState } from "react";

export function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50/80 font-sans text-slate-800 antialiased">
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopNav />
        <main className="flex-1 p-6 md:p-8 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
