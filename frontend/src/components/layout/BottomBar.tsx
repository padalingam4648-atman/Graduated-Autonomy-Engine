import { Activity, Database, Server } from "lucide-react";
import clsx from "clsx";

export function BottomBar({ health }: { health: string }) {
  const isHealthy = health === "healthy";
  return (
    <footer className="app-footer">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-success" />
        <span>Groq AI: <span className="font-medium text-success">Online</span></span>
      </div>
      <div className="flex items-center gap-2">
        <Database size={14} className={clsx(isHealthy ? "text-success" : "text-danger")} />
        <span>MySQL: <span className={clsx("font-medium", isHealthy ? "text-success" : "text-danger")}>{isHealthy ? "Connected" : "Error"}</span></span>
      </div>
      <div className="flex items-center gap-2">
        <Server size={14} className={clsx(isHealthy ? "text-success" : "text-danger")} />
        <span>Audit Repository: <span className={clsx("font-medium", isHealthy ? "text-success" : "text-danger")}>{isHealthy ? "Syncing" : "Offline"}</span></span>
      </div>
    </footer>
  );
}
