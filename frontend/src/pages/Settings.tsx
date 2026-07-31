import { useState } from "react";
import { Save, Server, Shield, Brain, CheckCircle2, Sliders, Database, Cpu, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Settings() {
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.0);
  const [maxTurns, setMaxTurns] = useState(12);
  const [lowThreshold, setLowThreshold] = useState(0.30);
  const [highThreshold, setHighThreshold] = useState(0.75);
  const [autoMeasure, setAutoMeasure] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-xl border border-emerald-400/40"
          >
            <CheckCircle2 size={20} className="text-white" />
            <span>Configuration settings saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Sliders className="text-emerald-500" size={26} />
          Engine Configuration Hub
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Control LLM parameters, database connection backends, and graduated risk routing thresholds.
        </p>
      </div>

      {/* 1. AI Model Configuration */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Brain className="text-emerald-500" size={20} /> AI Agent Model Settings
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Groq LLaMA Inference
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Primary LLM Provider
            </label>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold">
              <Cpu size={18} className="text-emerald-600" />
              <span>Groq API (v1 / Cloud Execution)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Active Model Architecture
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-3 text-sm font-medium bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fast Tier)</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
            </select>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Temperature
              </label>
              <span className="font-mono text-xs font-bold text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Temperature 0.0 enforces deterministic reasoning & reproducible risk scoring.
            </p>
          </div>

          {/* Max Loop Turns */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Max Agent Planning Loop Turns
              </label>
              <span className="font-mono text-xs font-bold text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                {maxTurns} turns
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={maxTurns}
              onChange={(e) => setMaxTurns(parseInt(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Limits count_matching_rows measurement phase iterations per request.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Database Integration Status */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Server className="text-blue-500" size={20} /> Infrastructure & Database Backends
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            All Services Operational
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-emerald-500" /> Transaction CSV Data Store
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono">customer_shopping_data.csv</div>
            <div className="text-xs text-slate-500">99,457 retail records with pre-write snapshotting</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={14} className="text-emerald-500" /> Audit Log Repository
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> DynamoDB Ready
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono">ps-9-1-autonomy-engine-audit-log</div>
            <div className="text-xs text-slate-500">PAY_PER_REQUEST billing mode (scan limit 200)</div>
          </div>
        </div>
      </div>

      {/* 3. Risk Thresholds & Safety Net */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="text-rose-500" size={20} /> Governance & Supervision Thresholds
          </h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm text-slate-900">Low Risk Threshold (Autonomous Execution)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Actions scored below this boundary execute immediately without human intervention.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.10"
                max="0.50"
                step="0.05"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(parseFloat(e.target.value))}
                className="w-32 accent-emerald-600 cursor-pointer"
              />
              <span className="font-mono text-sm font-bold text-emerald-700 w-12 text-right">
                {lowThreshold.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm text-slate-900">Medium Risk Threshold (One-Click Confirmation)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Actions scored between Low and Medium require human confirmation before execution.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.50"
                max="0.90"
                step="0.05"
                value={highThreshold}
                onChange={(e) => setHighThreshold(parseFloat(e.target.value))}
                className="w-32 accent-amber-600 cursor-pointer"
              />
              <span className="font-mono text-sm font-bold text-amber-700 w-12 text-right">
                {highThreshold.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-slate-900">Phase 1 Measurement Safety Net</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Mandate count_matching_rows measurement before accepting bulk mutation proposals.
              </div>
            </div>
            <button
              onClick={() => setAutoMeasure(!autoMeasure)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                autoMeasure ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoMeasure ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          {saving ? (
            <>
              <div className="spinner w-4 h-4 border-2 border-white border-l-transparent" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Configuration</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
