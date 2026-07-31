import { useEffect, useState, useMemo } from "react";
import { getAllAuditLogs } from "../api";
import type { AuditEntry } from "../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Rocket,
  Hourglass,
  Users,
} from "lucide-react";

const RISK_COLORS = ["#EF4444", "#F59E0B", "#10B981"]; // High, Med, Low
const DECISION_COLORS = ["#10B981", "#F59E0B", "#EF4444"]; // Auto, Confirm, Review

export function Dashboard() {
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllAuditLogs()
      .then((logsData) => {
        setRecentLogs(logsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Compute real dynamic metrics strictly from actual backend data
  const realMetrics = useMemo(() => {
    const total = recentLogs.length;
    const autonomous = recentLogs.filter((l) => l.routing_decision === "autonomous").length;
    const confirm = recentLogs.filter((l) => l.routing_decision === "confirm").length;
    const fullReview = recentLogs.filter((l) => l.routing_decision === "full_review").length;

    const pendingConfirm = recentLogs.filter(
      (l) => l.routing_decision === "confirm" && (l.status === "pending" || l.status === "pending_confirmation")
    ).length;

    const humanReviews = recentLogs.filter(
      (l) => l.routing_decision === "full_review" && (l.status === "pending" || l.status === "pending_review")
    ).length;

    const highRiskCount = recentLogs.filter((l) => (l.composite_score || 0) >= 0.75).length;
    const medRiskCount = recentLogs.filter(
      (l) => (l.composite_score || 0) >= 0.4 && (l.composite_score || 0) < 0.75
    ).length;
    const lowRiskCount = recentLogs.filter((l) => (l.composite_score || 0) < 0.4).length;

    return {
      total,
      autonomous,
      confirm,
      fullReview,
      pendingConfirm,
      humanReviews,
      highRiskCount,
      medRiskCount,
      lowRiskCount,
    };
  }, [recentLogs]);

  // Compute 7-day request trends dynamically from actual timestamps
  const chartData = useMemo(() => {
    const days: { [dateStr: string]: number } = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[dateKey] = 0;
    }

    recentLogs.forEach((log) => {
      if (log.timestamp) {
        const d = new Date(log.timestamp);
        const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (days[dateKey] !== undefined) {
          days[dateKey] += 1;
        }
      }
    });

    return Object.keys(days).map((date) => ({ date, requests: days[date] }));
  }, [recentLogs]);

  const riskData = useMemo(() => {
    const total = realMetrics.total || 1;
    return [
      {
        name: "High Risk",
        value: realMetrics.highRiskCount,
        percentage: realMetrics.total > 0 ? `${Math.round((realMetrics.highRiskCount / total) * 100)}%` : "0%",
      },
      {
        name: "Medium Risk",
        value: realMetrics.medRiskCount,
        percentage: realMetrics.total > 0 ? `${Math.round((realMetrics.medRiskCount / total) * 100)}%` : "0%",
      },
      {
        name: "Low Risk",
        value: realMetrics.lowRiskCount,
        percentage: realMetrics.total > 0 ? `${Math.round((realMetrics.lowRiskCount / total) * 100)}%` : "0%",
      },
    ];
  }, [realMetrics]);

  const decisionData = useMemo(() => {
    const total = realMetrics.total || 1;
    return [
      {
        name: "Autonomous",
        value: realMetrics.autonomous,
        percentage: realMetrics.total > 0 ? `${((realMetrics.autonomous / total) * 100).toFixed(1)}%` : "0%",
      },
      {
        name: "Confirmation",
        value: realMetrics.confirm,
        percentage: realMetrics.total > 0 ? `${((realMetrics.confirm / total) * 100).toFixed(1)}%` : "0%",
      },
      {
        name: "Full Review",
        value: realMetrics.fullReview,
        percentage: realMetrics.total > 0 ? `${((realMetrics.fullReview / total) * 100).toFixed(1)}%` : "0%",
      },
    ];
  }, [realMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, Administrator! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor AI-powered governance, database activity and audit events in real time.
          </p>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requests</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {realMetrics.total.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <Activity size={20} />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {realMetrics.total > 0 ? "Derived from live audit telemetry" : "No queries executed yet"}
          </div>
        </div>

        {/* Autonomous Executions */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Autonomous Executions</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {realMetrics.autonomous.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Rocket size={20} />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {realMetrics.total > 0 ? `${((realMetrics.autonomous / (realMetrics.total || 1)) * 100).toFixed(0)}% of total queries` : "Zero autonomous runs"}
          </div>
        </div>

        {/* Pending Confirmations */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Confirmations</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {realMetrics.pendingConfirm.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <Hourglass size={20} />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {realMetrics.pendingConfirm > 0 ? "Awaiting human approval" : "Queue clear"}
          </div>
        </div>

        {/* Human Reviews Required */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Human Reviews Required</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {realMetrics.humanReviews.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <Users size={20} />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {realMetrics.humanReviews > 0 ? "High risk queue active" : "No pending reviews"}
          </div>
        </div>
      </div>

      {/* 3. Main Analytics Section: Requests Over Time Line Chart + Risk & Decision Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Requests Over Time Line Chart */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 min-h-[360px]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Requests Over Time</h3>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-mono">
              Last 7 Days
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} dx={-8} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                />
                <Area type="monotone" dataKey="requests" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorReq)" dot={{ fill: "#10B981", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Risk & Decision Distributions */}
        <div className="lg:col-span-4 space-y-5">
          {/* Risk Distribution Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Risk Distribution</h3>
            <div className="relative h-[130px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={58}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {riskData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[index]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-slate-900">{realMetrics.total}</span>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Total</span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> High Risk
                </span>
                <span className="font-semibold text-slate-900">
                  {riskData[0].percentage} <span className="text-slate-400 font-normal">({realMetrics.highRiskCount})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Medium Risk
                </span>
                <span className="font-semibold text-slate-900">
                  {riskData[1].percentage} <span className="text-slate-400 font-normal">({realMetrics.medRiskCount})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low Risk
                </span>
                <span className="font-semibold text-slate-900">
                  {riskData[2].percentage} <span className="text-slate-400 font-normal">({realMetrics.lowRiskCount})</span>
                </span>
              </div>
            </div>
          </div>

          {/* Decision Distribution Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Decision Distribution</h3>
            <div className="relative h-[130px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {decisionData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={DECISION_COLORS[index]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Autonomous
                </span>
                <span className="font-semibold text-slate-900">
                  {decisionData[0].percentage} <span className="text-slate-400 font-normal">({realMetrics.autonomous})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Confirmation
                </span>
                <span className="font-semibold text-slate-900">
                  {decisionData[1].percentage} <span className="text-slate-400 font-normal">({realMetrics.confirm})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Full Review
                </span>
                <span className="font-semibold text-slate-900">
                  {decisionData[2].percentage} <span className="text-slate-400 font-normal">({realMetrics.fullReview})</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
