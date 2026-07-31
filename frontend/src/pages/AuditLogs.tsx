import { useEffect, useState, useMemo } from "react";
import { getAllAuditLogs } from "../api";
import type { AuditEntry } from "../types";
import {
  Search,
  Shield,
  ChevronRight,
  X,
  Database,
  Zap,
  Clock,
  FileText,
  Code,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskTab, setRiskTab] = useState<"all" | "low" | "medium" | "high">("all");
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    getAllAuditLogs().then((data: AuditEntry[]) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Risk tab filter
      if (riskTab === "low" && log.routing_decision !== "autonomous") return false;
      if (riskTab === "medium" && log.routing_decision !== "confirm") return false;
      if (riskTab === "high" && log.routing_decision !== "full_review") return false;

      // Text search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (log.description || log.action_type || "").toLowerCase();
        const sess = (log.session_id || "").toLowerCase();
        const reviewer = (log.reviewer || "").toLowerCase();
        const tool = (log.tool_name || "").toLowerCase();
        return desc.includes(q) || sess.includes(q) || reviewer.includes(q) || tool.includes(q);
      }

      return true;
    });
  }, [logs, searchQuery, riskTab]);

  // Metric totals
  const metrics = useMemo(() => {
    const total = logs.length;
    const autonomous = logs.filter((l) => l.routing_decision === "autonomous").length;
    const confirm = logs.filter((l) => l.routing_decision === "confirm").length;
    const fullReview = logs.filter((l) => l.routing_decision === "full_review").length;
    const avgScore =
      total > 0
        ? logs.reduce((acc, l) => acc + (l.composite_score || 0), 0) / total
        : 0;

    return { total, autonomous, confirm, fullReview, avgScore };
  }, [logs]);

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Shield className="text-emerald-500" size={26} />
            Enterprise Audit Command Center
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tamper-evident, queryable ledger of every AI decision, risk factor breakdown, and execution outcome.
          </p>
        </div>
      </div>

      {/* Summary Metric Pills */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200/80 shadow-xs py-3 px-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Records</div>
            <div className="text-xl font-bold text-slate-900">{metrics.total}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 shadow-xs py-3 px-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Autonomous</div>
            <div className="text-xl font-bold text-emerald-600">{metrics.autonomous}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 shadow-xs py-3 px-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Confirm Queue</div>
            <div className="text-xl font-bold text-amber-600">{metrics.confirm}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 shadow-xs py-3 px-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <Lock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Full Review</div>
            <div className="text-xl font-bold text-rose-600">{metrics.fullReview}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 shadow-xs py-3 px-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Risk Score</div>
            <div className="text-xl font-bold text-indigo-600">{metrics.avgScore.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Tabs */}
      <div className="bg-white border border-slate-200/80 p-3 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          {(["all", "low", "medium", "high"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRiskTab(tab)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 capitalize cursor-pointer",
                riskTab === tab
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              {tab === "all" ? "All Logs" : `${tab} Risk`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queries, sessions, reviewers..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs flex-1 p-0 overflow-hidden flex flex-col min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container border-0 rounded-none h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                <tr className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Proposal</th>
                  <th className="py-3 px-4">Routing Decision</th>
                  <th className="py-3 px-4">Risk Bar</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => {
                  const score = log.composite_score ?? 0;
                  const scorePct = Math.round(score * 100);
                  const barColor =
                    score >= 0.75
                      ? "bg-rose-500"
                      : score >= 0.4
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  return (
                    <tr
                      key={log.record_id}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowRawJson(false);
                      }}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 max-w-[260px] truncate font-medium text-slate-900" title={log.description || ""}>
                        {log.description || log.action_type}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            "badge text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 capitalize",
                            log.routing_decision === "autonomous"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : log.routing_decision === "confirm"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          )}
                        >
                          {log.routing_decision?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={clsx("h-full transition-all duration-300", barColor)}
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-700 font-semibold w-8 text-right">
                            {score.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            "badge text-xs font-medium px-2 py-0.5 rounded capitalize",
                            log.status === "auto_executed" || log.status === "confirmed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : log.status === "pending"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          )}
                        >
                          {log.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs font-medium">
                        {log.reviewer || <span className="text-slate-400 italic">System</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all inline-block" />
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-500 font-medium">
                      No matching audit records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      <AnimatePresence>
        {selectedLog && (
          <div className="drawer-overlay fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end" onClick={() => setSelectedLog(null)}>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="drawer-content w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Audit Trail Inspection</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      ID: {selectedLog.record_id?.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Session: {selectedLog.session_id}
                  </p>
                </div>
                <button
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                  onClick={() => setSelectedLog(null)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Action Summary Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} className="text-emerald-500" /> Action Intent
                    </span>
                    <span className="font-mono text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold">
                      {selectedLog.tool_name || selectedLog.action_type}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-slate-900 leading-relaxed">
                    {selectedLog.description}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-500">Routing Outcome:</span>
                    <span className="font-bold uppercase text-emerald-700">
                      {selectedLog.routing_decision}
                    </span>
                  </div>
                </div>

                {/* Risk Dimensions Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Four Risk Dimensions Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Reversibility</div>
                      <div className="text-sm font-bold text-slate-900 capitalize mt-0.5">
                        {selectedLog.reversibility || "reversible"}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedLog.reversibility_reasoning || "Read operation — non-mutating"}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Data Scope</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                        {selectedLog.data_scope !== undefined ? `${selectedLog.data_scope} rows` : "N/A"}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedLog.data_scope_reasoning || "Filter match count"}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Regulatory Category</div>
                      <div className="text-sm font-bold text-slate-900 capitalize mt-0.5">
                        {selectedLog.regulatory_category || "none"}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedLog.regulatory_reasoning || "Standard transaction field query"}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Confidence</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                        {selectedLog.confidence !== undefined ? `${Math.round(selectedLog.confidence * 100)}%` : "N/A"}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedLog.confidence_reasoning || "Explicit criteria matches"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rationale Card */}
                {selectedLog.rationale && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                    <div className="font-semibold uppercase tracking-wider text-[10px] text-emerald-700">
                      Model Risk Rationale
                    </div>
                    <p className="italic">{selectedLog.rationale}</p>
                  </div>
                )}

                {/* Execution Details Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span className="flex items-center gap-1.5">
                      <Database size={14} className="text-emerald-500" /> Database Execution Result
                    </span>
                    <span className="font-mono text-emerald-600 font-bold">{selectedLog.execution_status || selectedLog.status}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-mono">
                    {selectedLog.execution_detail || selectedLog.detail || "Executed against retail transaction database."}
                  </p>
                  {selectedLog.snapshot_path && (
                    <div className="text-xs text-slate-500 font-mono pt-2 border-t border-slate-200">
                      Snapshot Tag: <span className="text-emerald-700 font-semibold">{selectedLog.snapshot_path}</span>
                    </div>
                  )}
                </div>

                {/* Raw JSON Toggle */}
                <div>
                  <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    <Code size={14} />
                    {showRawJson ? "Hide Raw Payload JSON" : "View Raw Payload JSON"}
                  </button>

                  {showRawJson && (
                    <pre className="mt-3 p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 max-h-60">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
