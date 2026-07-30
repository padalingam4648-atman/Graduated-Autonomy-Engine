import { useEffect, useState } from "react";
import { getAllAuditLogs } from "../api";
import type { AuditEntry } from "../types";
import { Search, Filter, Shield, ChevronRight, X, Database, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  useEffect(() => {
    getAllAuditLogs().then((data: AuditEntry[]) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="text-[var(--color-primary)]" size={24} />
            Enterprise Audit Repository
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Complete history of every AI decision and database execution.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
            <input type="text" placeholder="Search sessions or queries..." className="input-field pl-10 py-2 text-sm" />
          </div>
          <button className="btn btn-secondary py-2 text-sm">
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      <div className="glass-card flex-1 p-0 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container border-0 rounded-none h-full border-t border-[var(--border-light)]">
            <table className="w-full">
              <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10 shadow-sm">
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Routing</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.record_id} className="cursor-pointer hover:bg-blue-50/30 transition-colors" onClick={() => setSelectedLog(log)}>
                    <td className="whitespace-nowrap font-mono text-xs text-[var(--text-secondary)]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-[200px] truncate" title={log.description || ""}>
                      {log.description || log.action_type}
                    </td>
                    <td>
                      <span className={clsx(
                        "badge",
                        log.routing_decision === "autonomous" ? "badge-green" :
                        log.routing_decision === "confirm" ? "badge-yellow" : "badge-red"
                      )}>
                        {log.routing_decision?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">{log.composite_score?.toFixed(2) || "N/A"}</span>
                    </td>
                    <td>
                      <span className={clsx(
                        "badge",
                        log.status === "auto_executed" ? "badge-green" :
                        log.status === "pending" ? "badge-gray" : "badge-blue"
                      )}>
                        {log.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {log.reviewer || <span className="text-[var(--text-tertiary)] italic">System</span>}
                    </td>
                    <td className="text-right">
                      <ChevronRight size={16} className="text-[var(--text-tertiary)] inline-block" />
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--text-tertiary)]">No audit records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedLog && (
          <div className="drawer-overlay" onClick={() => setSelectedLog(null)}>
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="drawer-content"
              onClick={e => e.stopPropagation()}
            >
              <div className="drawer-header">
                <h3 className="text-lg font-bold">Audit Record Details</h3>
                <button className="btn-icon" onClick={() => setSelectedLog(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-body">
                <div className="mb-6">
                  <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">User Prompt / Intent</div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-[var(--text-primary)]">
                    {selectedLog.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-1 text-[var(--text-secondary)]">
                      <Shield size={16} /> <span className="text-xs font-semibold uppercase tracking-wider">Risk Score</span>
                    </div>
                    <div className="text-2xl font-bold">{selectedLog.composite_score?.toFixed(2) || "N/A"}</div>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-1 text-[var(--text-secondary)]">
                      <UserCheck size={16} /> <span className="text-xs font-semibold uppercase tracking-wider">Reviewer</span>
                    </div>
                    <div className="text-lg font-medium">{selectedLog.reviewer || "AI Engine (Autonomous)"}</div>
                  </div>
                  <div className="glass-card p-4 col-span-2">
                     <div className="flex items-center gap-2 mb-1 text-[var(--text-secondary)]">
                      <Database size={16} /> <span className="text-xs font-semibold uppercase tracking-wider">Execution Detail</span>
                    </div>
                    <div className="text-sm font-medium">{selectedLog.execution_detail || "Pending Execution"}</div>
                  </div>
                </div>

                <h4 className="font-bold mb-4">Execution Timeline</h4>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-icon completed"><CheckCircle size={14} /></div>
                    <div className="timeline-content">
                      <div className="font-semibold text-sm">Request Received</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-icon completed"><CheckCircle size={14} /></div>
                    <div className="timeline-content">
                      <div className="font-semibold text-sm">Groq Intent Analysis</div>
                      <div className="text-xs text-[var(--text-secondary)]">Parsed to action: <span className="font-mono bg-[var(--bg-secondary)] px-1 rounded">{selectedLog.action_type}</span></div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-icon completed"><CheckCircle size={14} /></div>
                    <div className="timeline-content">
                      <div className="font-semibold text-sm">Risk Assessment</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {Object.entries((selectedLog.risk_breakdown as Record<string, string>) || {}).map(([k,v]) => (
                          <span key={k} className="mr-2 inline-block"><span className="font-medium">{k}:</span> {v}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-icon completed"><CheckCircle size={14} /></div>
                    <div className="timeline-content">
                      <div className="font-semibold text-sm">Decision Routing</div>
                      <div className="text-xs text-[var(--text-secondary)]">Routed to <span className="uppercase font-semibold">{selectedLog.routing_decision}</span> queue</div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className={clsx("timeline-icon", selectedLog.execution_status === "success" ? "completed" : "pending")}>
                      {selectedLog.execution_status === "success" && <CheckCircle size={14} />}
                    </div>
                    <div className="timeline-content">
                      <div className={clsx("font-semibold text-sm", selectedLog.execution_status !== "success" && "text-[var(--text-tertiary)]")}>Database Execution</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{selectedLog.execution_status === "success" ? "Completed successfully" : "Awaiting approval"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckCircle({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
}
