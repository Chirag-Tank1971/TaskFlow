import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import StatCard from "../components/common/StatCard";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  CheckSquare,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Analytics = () => {
  const [data, setData] = useState({
    categoryStats: [],
    agentStats: [],
    statusStats: [],
    totalTasks: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [tasksRes, agentsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/tasks`),
        axios.get(`${API_BASE_URL}/api/agents`),
      ]);

      const tasks = tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.data)
        ? tasksRes.value.data
        : tasksRes.status === "fulfilled" && tasksRes.value.data?.tasks
        ? tasksRes.value.data.tasks
        : [];

      const agents = agentsRes.status === "fulfilled" && Array.isArray(agentsRes.value.data)
        ? agentsRes.value.data
        : [];

      // Category count
      const catCount = {};
      const agentCount = {};
      let completed = 0;
      let inProgress = 0;
      let pending = 0;

      tasks.forEach((t) => {
        const c = t.category || "General";
        catCount[c] = (catCount[c] || 0) + 1;

        if (t.agent?.name) {
          agentCount[t.agent.name] = (agentCount[t.agent.name] || 0) + 1;
        }

        if (t.status === "completed") completed++;
        else if (t.status === "in-progress") inProgress++;
        else pending++;
      });

      const categoryStats = Object.entries(catCount).map(([name, count]) => ({
        name,
        count,
      }));

      const agentStats = Object.entries(agentCount).map(([name, tasks]) => ({
        name,
        tasks,
      }));

      const statusStats = [
        { name: "Completed", value: completed, color: "#10B981" },
        { name: "In Progress", value: inProgress, color: "#0EA5E9" },
        { name: "Pending", value: pending, color: "#F59E0B" },
      ];

      setData({
        categoryStats,
        agentStats,
        statusStats,
        totalTasks: tasks.length,
        completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const CATEGORY_COLORS = ["#6366F1", "#10B981", "#8B5CF6", "#F59E0B", "#F43F5E", "#64748B"];

  return (
    <AppLayout
      title="Intelligence & Performance Analytics"
      subtitle="Quantitative metrics covering operational velocity, category densities, and agent workload distribution"
      action={
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Analytics</span>
        </button>
      }
    >
      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard
          title="Total Work Orders"
          value={data.totalTasks}
          subtitle="Processed across all channels"
          icon={CheckSquare}
          color="indigo"
        />
        <StatCard
          title="Resolution Velocity"
          value={`${data.completionRate}%`}
          subtitle="Current completion ratio"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Functional Domains"
          value={data.categoryStats.length}
          subtitle="Active task categories"
          icon={BarChart3}
          color="violet"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Task Volume by Category
          </h2>
          <p className="text-xs text-slate-400 mb-6">Distribution across business domains</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryStats}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#F8FAFC",
                  }}
                />
                <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]}>
                  {data.categoryStats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Distribution */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            Pipeline Status Split
          </h2>
          <p className="text-xs text-slate-400 mb-6">Pending vs In-Progress vs Completed</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusStats.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={5}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.statusStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#F8FAFC",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Workload Distribution */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-cyan-400" />
          Agent Workload Distribution
        </h2>
        <p className="text-xs text-slate-400 mb-6">Tasks assigned per agent</p>

        <div className="h-64 w-full">
          {data.agentStats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.agentStats} layout="vertical">
                <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#F8FAFC",
                  }}
                />
                <Bar dataKey="tasks" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No agent workload data available.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Analytics;
