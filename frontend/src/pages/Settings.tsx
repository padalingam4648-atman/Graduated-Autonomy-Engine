import { Save, Server, Shield, Brain } from "lucide-react";

export function Settings() {
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Platform Settings</h2>
        <p className="text-[var(--text-secondary)]">Configure AI models, database connections, and governance thresholds.</p>
      </div>

      <div className="glass-card">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Brain className="text-indigo-600" /> AI Configuration
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Primary Provider</label>
            <input type="text" className="input-field bg-slate-50 text-slate-500" value="Groq" disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Current Model</label>
            <input type="text" className="input-field" defaultValue="llama3-70b-8192" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Temperature</label>
            <input type="number" className="input-field" defaultValue="0" step="0.1" max="1" min="0" />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Lower temperature (0.0) is recommended for SQL determinism.</p>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Server className="text-blue-600" /> Database Integration
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Connection Status</label>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Connected (Local SQLite/Mock)
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Audit Repository Backend</label>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              DynamoDB (Reachable)
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Shield className="text-rose-600" /> Risk Thresholds
        </h3>
        <div className="space-y-4">
          <div className="p-4 border border-[var(--border-light)] rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Low Risk (Autonomous Execution)</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">Actions with composite score below this threshold execute instantly.</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="input-field w-24 text-center py-1" defaultValue="0.30" step="0.05" />
            </div>
          </div>
          <div className="p-4 border border-[var(--border-light)] rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Medium Risk (Requires Confirmation)</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">Actions scored between Low and High require a single-click confirmation.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-tertiary)]">Up to</span>
              <input type="number" className="input-field w-24 text-center py-1" defaultValue="0.75" step="0.05" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 pb-12">
        <button className="btn btn-primary px-8 shadow-md">
          <Save size={16} /> Save Configuration
        </button>
      </div>
    </div>
  );
}
