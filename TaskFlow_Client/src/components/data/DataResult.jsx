import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { toast } from "react-toastify";
import { Database, ArrowUpDown } from "lucide-react";
import TaskModal from "../tasks/TaskModal";
import CategoryBadge from "../CategoryBadge";
import { CALL_OUTCOMES } from "../../constants/callOutcomes";
import { ACTIVITY_TYPES } from "../../constants/activityTypes";

const TOOL_LABELS = {
  search_tasks: "Task search",
  count_tasks: "Task count",
  agent_workload: "Agent workload",
  search_activity: "Activity log",
  upload_history: "Upload history",
};

const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "in-progress": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Not-Available": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Decommissioned: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  processing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const CATEGORY_KEYS = ["Support", "Sales", "Technical", "Billing", "Urgent", "General"];

const renderCell = (col, value) => {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">—</span>;
  if (col.type === "date") {
    return (
      <span className="whitespace-nowrap">
        {new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  if (col.type === "number") return <span className="tabular-nums font-semibold text-slate-200">{value}</span>;
  if (col.type === "badge") {
    if (CATEGORY_KEYS.includes(value)) return <CategoryBadge category={value} size="xs" />;
    const outcome = CALL_OUTCOMES[value];
    if (outcome) return <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap ${outcome.color}`}>{outcome.label}</span>;
    const activity = ACTIVITY_TYPES[value];
    if (activity) return <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap ${activity.color}`}>{activity.label}</span>;
    return (
      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border capitalize whitespace-nowrap ${STATUS_STYLES[value] || "bg-slate-800 text-slate-300 border-slate-700"}`}>
        {value}
      </span>
    );
  }
  return <span className="line-clamp-2">{String(value)}</span>;
};

/**
 * Renders one answer from the data assistant (POST /api/data/ask): a caption showing what was
 * queried, then a count, a message, or a sortable table. Task rows open the task details.
 */
const DataResult = ({ result: initialResult }) => {
  const [result, setResult] = useState(initialResult);
  const [sort, setSort] = useState(null); // { key, dir }
  const [openTask, setOpenTask] = useState(null);

  const sortedRows = useMemo(() => {
    const rows = result?.rows || [];
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [result, sort]);

  const recordsById = useMemo(() => new Map((result?.records || []).map((r) => [r._id?.toString(), r])), [result]);

  const toggleSort = (key) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  // Keep status changes from the task modal in sync with the table
  const handleStatusChange = async (taskId, status) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tasks/${taskId}`, { status });
      const updated = res.data.task;
      setResult((r) => ({
        ...r,
        rows: r.rows.map((row) => (row._id === taskId ? { ...row, status: updated.status } : row)),
        records: r.records.map((rec) => (rec._id?.toString() === taskId ? updated : rec)),
      }));
      toast.success(`Task moved to ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Status update failed");
    }
  };

  if (result.entity === "message") {
    return <div className="text-xs text-slate-200 leading-relaxed">{result.message}</div>;
  }

  const isCount = result.entity === "count";

  return (
    <div>
      {/* What was actually queried, so the admin can check the AI understood */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[11px]">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-semibold">
          <Database className="w-3 h-3" />
          {TOOL_LABELS[result.tool] || result.tool}
        </span>
        <span className="text-slate-400">{result.caption}</span>
        {!isCount && (
          <span className="text-slate-500">
            · {result.total} result{result.total === 1 ? "" : "s"}
            {result.rows?.length < result.total && ` (showing ${result.rows.length})`}
          </span>
        )}
      </div>

      {isCount ? (
        <div className="text-3xl font-extrabold text-white tabular-nums">{result.rows?.[0]?.count ?? 0}</div>
      ) : sortedRows.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500">No matching records.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-900 text-slate-400 sticky top-0">
              <tr>
                {result.columns.map((col) => (
                  <th key={col.key} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">
                    <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-white">
                      {col.label}
                      <ArrowUpDown className={`w-3 h-3 ${sort?.key === col.key ? "text-indigo-400" : "text-slate-600"}`} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sortedRows.map((row, i) => {
                const record = result.entity === "task" ? recordsById.get(row._id) : null;
                return (
                  <tr
                    key={row._id || i}
                    onClick={record ? () => setOpenTask(record) : undefined}
                    className={`text-slate-300 ${record ? "cursor-pointer hover:bg-indigo-500/10" : ""}`}
                    title={record ? "Open task details" : undefined}
                  >
                    {result.columns.map((col) => (
                      <td key={col.key} className="px-2.5 py-2 align-top max-w-[220px]">
                        {renderCell(col, row[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Portal: the chat panel uses backdrop-blur, which would otherwise trap the fixed-position modal inside it */}
      {openTask &&
        createPortal(
          <TaskModal task={openTask} isOpen={true} onClose={() => setOpenTask(null)} onStatusChange={handleStatusChange} />,
          document.body
        )}
    </div>
  );
};

export default DataResult;
