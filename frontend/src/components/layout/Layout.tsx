import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { BottomBar } from "./BottomBar";
import { useEffect, useState } from "react";
import { getHealth } from "../../api";

export function Layout() {
  const [health, setHealth] = useState<string>("checking");

  useEffect(() => {
    getHealth()
      .then(res => setHealth(res.dynamodb === "reachable" ? "healthy" : "error"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main-wrapper">
        <TopNav />
        <main className="app-content">
          <Outlet />
        </main>
        <BottomBar health={health} />
      </div>
    </div>
  );
}
