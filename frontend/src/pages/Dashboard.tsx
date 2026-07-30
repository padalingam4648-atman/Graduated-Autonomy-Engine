import { useEffect, useState } from "react";
import { getDashboardStats } from "../api";
import type { DashboardStatsResponse } from "../types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, CheckCircle, Clock, ShieldAlert, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { motion, Variants } from "framer-motion";

const COLORS = ['#52B788', '#F59E0B', '#EF4444'];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats().then((data: DashboardStatsResponse) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!stats) return null;

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="dashboard-container"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="dashboard-stats-grid">
        <motion.div variants={itemVariants}>
          <StatCard title="Total Requests" value={stats.totalRequests} icon={<Activity size={24} />} color="var(--color-primary)" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard title="Autonomous Executions" value={stats.autonomousExecutions} icon={<CheckCircle size={24} />} color="var(--color-success)" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard title="Pending Confirmations" value={stats.pendingConfirmations} icon={<Clock size={24} />} color="var(--color-warning)" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard title="Human Reviews Required" value={stats.humanReviews} icon={<ShieldAlert size={24} />} color="var(--color-danger)" />
        </motion.div>
      </div>

      <div className="dashboard-charts-grid">
        <motion.div variants={itemVariants} className="dashboard-chart-card">
          <h3 className="dashboard-chart-header">
            <BarChart3 size={20} className="text-[var(--color-primary)]" />
            Requests Over Time
          </h3>
          <div className="dashboard-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.requestsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dx={-10} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="var(--color-primary)" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorReq)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="dashboard-chart-card">
          <h3 className="dashboard-chart-header">
            <PieChartIcon size={20} className="text-[var(--color-primary)]" />
            Risk Distribution
          </h3>
          <div className="dashboard-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1500}
                  animationBegin={200}
                >
                  {stats.riskDistribution.map((_entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} 
                  itemStyle={{ fontWeight: 600 }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="dashboard-stat-card group">
      <div>
        <p className="dashboard-stat-title">{title}</p>
        <h4 className="dashboard-stat-value">{value.toLocaleString()}</h4>
      </div>
      <div 
        className="dashboard-stat-icon-wrapper group-hover:scale-110 transition-transform duration-300" 
        style={{ color: color, borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
      >
        {icon}
      </div>
    </div>
  );
}
