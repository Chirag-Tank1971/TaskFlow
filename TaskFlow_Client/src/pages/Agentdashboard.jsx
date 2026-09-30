import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/layout/AppLayout";
import StatCard from "../components/common/StatCard";
import CategoryBadge from "../components/CategoryBadge";
import {
  CheckSquare,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Headphones,
  Zap,
  CalendarClock,
} from "lucide-react";
import { isCallbackDue, hasOpenCallback, formatCallbackTime } from "../constants/callOutcomes";

const AgentDashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    if (user?._id || user?.id) {
      fetchAgentTasks();
    }
  }, [user]);

  const fetchAgentTasks = async () => {
    const agentId = user?._id || user?.id;
    if (!agentId) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tasks/${agentId}`);
      const taskList = Array.isArray(res.data)
        ? res.data
        : res.data?.tasks
        ? res.data.tasks
        : [];

      setTasks(taskList);

      const total = taskList.length;
      const pending = taskList.filter((t) => t.status === "pending").length;
      const inProgress = taskList.filter((t) => t.status === "in-progress").length;
      const completed = taskList.filter((t) => t.status === "completed").length;

      setStats({ total, pending, inProgress, completed });
    } catch (err) {
      console.error("Agent tasks error:", err);
    } finally {
      setLoading(false);
    }
  };

  const urgentTasks = tasks.filter(
    (t) => t.category === "Urgent" && t.status !== "completed"
  );
  const pendingTasks = tasks.filter((t) => t.status !== "completed").slice(0, 5);
  const dueCallbacks = tasks.filter((t) => isCallbackDue(t));
  const nextCallback = tasks
    .filter((t) => hasOpenCallback(t) && !isCallbackDue(t))
    .sort((a, b) => new Date(a.callbackAt) - new Date(b.callbackAt))[0];

  const efficiencyRate = stats.total
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  return (
    <AppLayout
      title={`Welcome back, ${user?.name || "Agent"}`}
      subtitle="Here is your personal task pipeline and operational status for today"
      action={
        <Link
          to="/agent/tasks"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
        >
          <span>Open Tasks Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      }
    >
      {/* 4 Agent Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Assigned to You"
          value={stats.total}
          subtitle="Total assigned work orders"
          icon={CheckSquare}
          color="indigo"
        />
        <StatCard
          title="Pending Attention"
          value={stats.pending}
          subtitle="Waiting for initial action"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          subtitle="Currently active tasks"
          icon={PlayCircle}
          color="sky"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          subtitle={`${efficiencyRate}% completion rate`}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Callbacks Banner: due now, or the next one coming up */}
      {(dueCallbacks.length > 0 || nextCallback) && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-3 border ${
            dueCallbacks.length > 0
              ? "bg-rose-500/10 border-rose-500/30"
              : "bg-violet-500/10 border-violet-500/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                dueCallbacks.length > 0
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  : "bg-violet-500/20 text-violet-300 border-violet-500/40"
              }`}
            >
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {dueCallbacks.length > 0
                  ? `${dueCallbacks.length} callback${dueCallbacks.length > 1 ? "s" : ""} due now`
                  : `Next callback: ${nextCallback.firstName || "Customer"}`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {dueCallbacks.length > 0
                  ? "Customers are expecting your call."
                  : formatCallbackTime(nextCallback.callbackAt)}
              </p>
            </div>
          </div>
          <Link
            to="/agent/tasks?view=callbacks"
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-colors"
          >
            View Callbacks
          </Link>
        </div>
      )}

      {/* Urgent Warning Banner if any urgent task exists */}
      {urgentTasks.length > 0 && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center animate-pulse">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {urgentTasks.length} Urgent Priority Task(s) Require Immediate Attention
              </h3>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Identified by Gemini AI as critical resolution items.
              </p>
            </div>
          </div>
          <Link
            to="/agent/tasks"
            className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition-colors"
          >
            Review Urgent
          </Link>
        </div>
      )}

      {/* Main Grid: Priority Tasks + Productivity Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Tasks Queue */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Next In Your Queue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tasks waiting to be picked up or in-progress
              </p>
            </div>
            <Link
              to="/agent/tasks"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              View all ({tasks.length})
            </Link>
          </div>

          {pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map((t) => (
                <div
                  key={t._id}
                  className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {t.firstName || "Customer Contact"}
                      </span>
                      <CategoryBadge category={t.category} source={t.categorySource} size="xs" />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{t.notes || "No notes."}</p>
                    {t.phone && (
                      <span className="text-[11px] text-indigo-400 font-medium">
                        Ph: {t.phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border capitalize ${
                        t.status === "in-progress"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {t.status}
                    </span>
                    <Link
                      to="/agent/tasks"
                      className="px-3 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              You have no active pending tasks! Great job clearing the queue.
            </div>
          )}
        </div>

        {/* Productivity Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Efficiency Progress
            </h2>
            <p className="text-xs text-slate-400">Completion velocity tracker</p>

            <div className="mt-6 mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-extrabold text-white">{efficiencyRate}%</span>
                <span className="text-xs text-slate-400">
                  {stats.completed} of {stats.total} closed
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${efficiencyRate}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Email:</span>
                <span className="font-semibold text-slate-200">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role Authority:</span>
                <span className="font-semibold text-cyan-400 uppercase text-[10px]">
                  Field Agent
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Operational Status:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Available
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/agent/tasks"
            className="w-full mt-6 py-2.5 px-4 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>Manage All Assigned Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgentDashboard;
