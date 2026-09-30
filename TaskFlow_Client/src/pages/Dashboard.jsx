import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import StatCard from "../components/common/StatCard";
import CategoryBadge from "../components/CategoryBadge";
import {
  CheckSquare,
  Users,
  UploadCloud,
  BarChart3,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    activeAgents: 0,
    totalAgents: 0,
    aiCategorized: 0,
  });
  const [categoryData, setCategoryData] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tasksRes, agentsRes, catRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/tasks`),
        axios.get(`${API_BASE_URL}/api/agents`),
        axios.get(`${API_BASE_URL}/api/categorization/stats`),
      ]);

      const tasks = tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.data)
        ? tasksRes.value.data
        : tasksRes.status === "fulfilled" && tasksRes.value.data?.tasks
        ? tasksRes.value.data.tasks
        : [];

      const agents = agentsRes.status === "fulfilled" && Array.isArray(agentsRes.value.data)
        ? agentsRes.value.data
        : [];

      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === "completed").length;
      const inProgress = tasks.filter((t) => t.status === "in-progress").length;
      const pending = tasks.filter((t) => t.status === "pending").length;
      const aiCategorized = tasks.filter((t) => t.categorySource === "ai").length;

      const activeAgents = agents.filter((a) => a.status === "Available").length;

      setStats({
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        activeAgents,
        totalAgents: agents.length,
        aiCategorized,
      });

      // Category breakdown
      const catCount = {};
      tasks.forEach((t) => {
        const c = t.category || "General";
        catCount[c] = (catCount[c] || 0) + 1;
      });

      const formattedCat = Object.entries(catCount).map(([name, count]) => ({
        name,
        count,
      }));
      setCategoryData(formattedCat);

      setRecentTasks(tasks.slice(0, 6));
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const completionRate = stats.totalTasks
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const aiRate = stats.totalTasks
    ? Math.round((stats.aiCategorized / stats.totalTasks) * 100)
    : 0;

  const statusPieData = [
    { name: "Completed", value: stats.completedTasks, color: "#10B981" },
    { name: "In Progress", value: stats.inProgressTasks, color: "#0ea5e9" },
    { name: "Pending", value: stats.pendingTasks, color: "#f59e0b" },
  ];

  return (
    <AppLayout
      title="Operations Command Center"
      subtitle="Real-time task distribution, agent efficiency metrics, and AI workflow telemetry"
      action={
        <div className="flex items-center gap-2.5">
          <Link
            to="/upload"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Task CSV</span>
          </Link>
          <Link
            to="/agents"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
          >
            <Users className="w-4 h-4" />
            <span>Manage Agents</span>
          </Link>
        </div>
      }
    >
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          subtitle={`${stats.pendingTasks} pending attention`}
          icon={CheckSquare}
          color="indigo"
        />
        <StatCard
          title="Active Agents"
          value={`${stats.activeAgents} / ${stats.totalAgents}`}
          subtitle="Currently online & available"
          icon={Users}
          color="emerald"
        />
        <StatCard
          title="Completion Rate"
          value={`${completionRate}%`}
          subtitle={`${stats.completedTasks} tasks closed`}
          icon={TrendingUp}
          trend={completionRate > 50 ? "+Velocity" : undefined}
          color="sky"
        />
        <StatCard
          title="AI Categorized"
          value={`${aiRate}%`}
          subtitle="Gemini 2.5 Flash assisted"
          icon={Sparkles}
          color="violet"
        />
      </div>

      {/* Visual Telemetry Grid: Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Category Volume Bar Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Category Volume Distribution
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Tasks organized across functional domains</p>
            </div>
            <Link
              to="/analytics"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Detailed view</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
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
                  <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No task categories to display. Upload a CSV to get started.
              </div>
            )}
          </div>
        </div>

        {/* Task Status Donut */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pipeline Health
            </h2>
            <p className="text-xs text-slate-400">Current progress split</p>
          </div>

          <div className="h-48 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                >
                  {statusPieData.map((entry, index) => (
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

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800 text-center">
            <div>
              <span className="text-[11px] text-slate-400 block">Pending</span>
              <span className="text-sm font-bold text-amber-400">{stats.pendingTasks}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Progress</span>
              <span className="text-sm font-bold text-sky-400">{stats.inProgressTasks}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Done</span>
              <span className="text-sm font-bold text-emerald-400">{stats.completedTasks}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tasks List */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Recent Distributed Tasks
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Most recently created or assigned tasks</p>
          </div>
        </div>

        {recentTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Assigned Agent</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentTasks.map((task) => (
                  <tr key={task._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300">
                        {task.firstName?.charAt(0) || "C"}
                      </div>
                      <span>{task.firstName || "Customer"}</span>
                    </td>
                    <td className="py-3">
                      <CategoryBadge
                        category={task.category}
                        source={task.categorySource}
                        size="xs"
                      />
                    </td>
                    <td className="py-3 text-slate-400">
                      {task.agent?.name || "Unassigned"}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          task.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : task.status === "in-progress"
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">
                      {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "Recent"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">
            No tasks recorded in TaskFlow. Click "Upload Task CSV" to seed the system.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
