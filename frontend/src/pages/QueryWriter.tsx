import { useState } from "react";
import { proposeAction, resolveConfirmation, resolveReview } from "../api";
import type { ApiError, ProposeResponse, ExecutionResult } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Terminal, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, Check, X, Search, Download, Database, FileSpreadsheet } from "lucide-react";
import clsx from "clsx";

export function QueryWriter() {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProposeResponse | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  
  // Stable session ID for this instance of the Query Writer
  const [sessionId] = useState(() => "session-" + Date.now());

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setExecutionResult(null);
    try {
      const res = await proposeAction(prompt, sessionId);
      setResult(res);
      if (res.routing_decision === "autonomous" && res.result) {
        setExecutionResult(res.result);
      }
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="glass-card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Terminal size={20} className="text-[var(--color-primary)]" />
          Natural Language Query
        </h2>
        <div className="relative">
          <textarea
            className="input-field min-h-[120px] resize-y text-lg p-4"
            placeholder="e.g. Show the first 10 customers from the database, or update invoice I132..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={submitting}
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
              className="btn btn-secondary text-sm px-4"
              onClick={() => { setPrompt(""); setResult(null); setExecutionResult(null); }}
              disabled={submitting || !prompt}
            >
              Clear
            </button>
            <button 
              className="btn btn-primary shadow-md hover:shadow-lg pl-5 pr-4"
              onClick={handleAnalyze}
              disabled={submitting || !prompt.trim()}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : "Analyze Request"}
              {!submitting && <Send size={16} className="ml-1" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle size={18} />
            {error}
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-6"
          >
            <ResultAnalysisCard result={result} />
            
            <ApprovalSection 
              result={result} 
              onResolved={(execRes) => {
                if (execRes) setExecutionResult(execRes);
              }} 
            />
          </motion.div>
        )}

        {executionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <DataResults result={executionResult} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultAnalysisCard({ result }: { result: ProposeResponse }) {
  if (result.routing_decision === "needs_clarification") {
    return (
      <div className="glass-card border-amber-200 bg-amber-50/50">
        <h3 className="text-lg font-bold text-amber-800 mb-2">Clarification Needed</h3>
        <p className="text-amber-900 mb-4">{result.question}</p>
        <p className="text-sm text-amber-700">Reason: {result.why}</p>
      </div>
    );
  }

  const { risk_score, routing_decision } = result;
  const isHighRisk = risk_score.risk_band === "high";
  const isMedRisk = risk_score.risk_band === "medium";

  return (
    <div className="glass-card">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" />
            AI Governance Analysis
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">{risk_score.rationale}</p>
        </div>
        <div className={clsx(
          "px-4 py-2 rounded-lg font-bold text-lg border",
          isHighRisk ? "bg-red-50 text-red-700 border-red-200" :
          isMedRisk ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-emerald-50 text-emerald-700 border-emerald-200"
        )}>
          {risk_score.composite_score.toFixed(2)} Risk Score
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Risk Band</div>
          <div className="font-medium capitalize flex items-center gap-1.5">
             {isHighRisk ? <span className="w-2 h-2 rounded-full bg-red-500"/> :
              isMedRisk ? <span className="w-2 h-2 rounded-full bg-amber-500"/> :
              <span className="w-2 h-2 rounded-full bg-emerald-500"/>}
             {risk_score.risk_band}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Routing</div>
          <div className="font-medium capitalize">{routing_decision.replace('_', ' ')}</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Data Scope</div>
          <div className="font-medium">{risk_score.actual_rows !== undefined ? `${risk_score.actual_rows} rows` : "Unknown"}</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Action Type</div>
          <div className="font-medium truncate capitalize">{(result as any).action_type?.replace(/_/g, ' ') || "Query"}</div>
        </div>
      </div>
    </div>
  );
}

function ApprovalSection({ result, onResolved }: { result: ProposeResponse, onResolved: (execRes?: ExecutionResult) => void }) {
  const [resolving, setResolving] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);

  if (result.routing_decision === "autonomous" || result.routing_decision === "needs_clarification") return null;

  const handleResolve = async (decision: "approve" | "reject" | "confirm") => {
    setResolving(true);
    try {
      if (result.routing_decision === "confirm") {
        const res = await resolveConfirmation((result as any).confirmation_id, decision as any, "admin");
        const succeeded = res.execution_status === "success";
        setResolvedStatus(succeeded ? "Confirmed & Executed" : (decision === "reject" ? "Rejected" : "Failed"));
        if (res.result) onResolved(res.result);
      } else if (result.routing_decision === "full_review") {
        const res = await resolveReview((result as any).review_id, decision as any, "admin");
        const succeeded = decision === "approve" && res.execution_status === "success";
        setResolvedStatus(succeeded ? "Approved & Executed" : (decision === "reject" ? "Rejected" : "Execution Failed"));
        if (res.result) onResolved(res.result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
  };

  if (resolvedStatus) {
    return (
      <div className="glass-card bg-emerald-50/30 border-emerald-200 flex items-center gap-3">
        <CheckCircle2 className="text-emerald-600" />
        <span className="font-medium text-emerald-800">Action Resolved: {resolvedStatus}</span>
      </div>
    );
  }

  return (
    <div className="glass-card border-[var(--color-warning)] shadow-[0_0_15px_rgba(245,158,11,0.1)]">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-700">
        <AlertTriangle size={20} />
        {result.routing_decision === "confirm" ? "Confirmation Required" : "Full Human Review Required"}
      </h3>
      <p className="mb-6 text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-4 rounded-lg font-mono text-sm">
        {(result as any).preview}
      </p>
      
      <div className="flex justify-end gap-3">
        <button 
          className="btn btn-secondary border-red-200 text-red-600 hover:bg-red-50"
          disabled={resolving}
          onClick={() => handleResolve("reject")}
        >
          <X size={16} /> Reject
        </button>
        <button 
          className="btn btn-success"
          disabled={resolving}
          onClick={() => handleResolve(result.routing_decision === "confirm" ? "confirm" : "approve")}
        >
          {resolving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {result.routing_decision === "confirm" ? "Confirm Execution" : "Approve & Execute"}
        </button>
      </div>
    </div>
  );
}

function DataResults({ result }: { result: ExecutionResult }) {
  const [filterText, setFilterText] = useState("");

  if (!result.rows || result.rows.length === 0) {
    return (
      <div className="glass-card">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Database size={18} className="text-indigo-600" />
          Execution Result
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">{result.detail || "No matching rows found."}</p>
      </div>
    );
  }

  const columns = Object.keys(result.rows[0]);

  const filteredRows = result.rows.filter((row: Record<string, string>) => {
    if (!filterText.trim()) return true;
    const query = filterText.toLowerCase();
    return columns.some((col) => String(row[col] ?? "").toLowerCase().includes(query));
  });

  const handleExportCSV = () => {
    if (result.rows.length === 0) return;
    const header = columns.join(",");
    const csvRows = result.rows.map((row) =>
      columns.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `query_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatColumnName = (col: string) => {
    return col
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="glass-card flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-indigo-600" />
          <h3 className="font-bold text-lg">Database Results</h3>
          <span className="badge badge-gray">{result.rows.length} rows returned</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Filter results..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-light)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="btn btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
            title="Export as CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-container max-h-[450px] overflow-y-auto rounded-lg border border-[var(--border-light)]">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-light)] z-10">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                  {formatColumnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)]">
            {filteredRows.length > 0 ? (
              filteredRows.map((row: Record<string, string>, i: number) => (
                <tr key={i} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                  {columns.map((c) => (
                    <td key={c + i} className="px-4 py-2.5 whitespace-nowrap font-mono text-xs">
                      {String(row[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-6 text-[var(--text-tertiary)]">
                  No matching rows for "{filterText}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
