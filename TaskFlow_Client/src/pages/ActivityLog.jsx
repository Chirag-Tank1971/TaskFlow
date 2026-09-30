import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import { toast } from "react-toastify";
import { Search, RefreshCw, ChevronLeft, ChevronRight, History } from "lucide-react";
import { ACTIVITY_TYPES, describeActivity, actorLabel, timeAgo } from "../constants/activityTypes";

const selectClass =
  "bg-slate-900/80 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]";

const ROLE_OPTIONS = [
  { value: "", label: "Everyone" },
  { value: "admin", label: "Admins" },
  { value: "manager", label: "Managers" },
  { value: "agent", label: "Agents" },
  { value: "system", label: "AI / System" },
];

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ type: "", actorRole: "", search: "", from: "", to: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the customer search so we don't query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      Object.entries(filters).forEach(([k, v]) => {
        if (!v) return;
        if (k === "from") params.from = new Date(`${v}T00:00:00`).toISOString();
        else if (k === "to") params.to = new Date(`${v}T23:59:59.999`).toISOString();
        else params[k] = v;
      });
      const res = await axios.get(`${API_BASE_URL}/api/activity`, { params });
      setActivities(res.data.activities || []);
      setPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <AppLayout
      title="Activity Log"
      subtitle="Every change to every task: who did what, and when"
      action={
        <button
          onClick={fetchActivity}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 mb-6 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by customer name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <select value={filters.type} onChange={setFilter("type")} className={selectClass}>
          <option value="">All actions</option>
          {Object.entries(ACTIVITY_TYPES).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>

        <select value={filters.actorRole} onChange={setFilter("actorRole")} className={selectClass}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter("from")} className={selectClass} />
        </label>
        <label className="text-[11px] text-slate-500 flex flex-col gap-1">
          To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} className={selectClass} />
        </label>

        {hasFilters && (
          <button
            onClick={() => {
              setFilters({ type: "", actorRole: "", search: "", from: "", to: "" });
              setSearchInput("");
              setPage(1);
            }}
            className="text-xs text-slate-400 hover:text-white px-2 py-2.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400">Loading activity...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <History className="w-6 h-6 text-slate-600" />
            {hasFilters ? "No activity matches these filters." : "No activity recorded yet."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {activities.map((a) => {
              const cfg = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.updated;
              const Icon = cfg.icon;
              return (
                <li key={a._id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                  <span className={`mt-0.5 w-7 h-7 flex-shrink-0 rounded-lg border flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs leading-relaxed">
                      <span className="font-semibold text-slate-200">{actorLabel(a.actor)}</span>
                      {a.actor?.role && a.actor.role !== "system" && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">{a.actor.role}</span>
                      )}{" "}
                      <span className="text-slate-400">{describeActivity(a, { subject: "the task" })}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Customer: <span className="text-slate-300 font-medium">{a.taskName || "Unknown"}</span>
                      {a.type === "call_logged" && a.meta?.note && <> · “{a.meta.note}”</>}
                    </div>
                  </div>
                  <span
                    className="text-[11px] text-slate-500 flex-shrink-0 whitespace-nowrap"
                    title={new Date(a.createdAt).toLocaleString()}
                  >
                    {timeAgo(a.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-400 px-3">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </AppLayout>
  );
};

export default ActivityLog;
