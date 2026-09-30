import React from "react";
import CategoryBadge from "../CategoryBadge";
import { Phone, PhoneCall, Clock, Eye, Pencil, Trash2, CheckCircle2, PlayCircle, AlertCircle, CalendarClock } from "lucide-react";
import { CALL_OUTCOMES, isCallbackDue, hasOpenCallback, formatCallbackTime } from "../../constants/callOutcomes";

const TaskCard = ({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  onViewDetails,
  onLogCall,
  onEdit,
  onDelete,
  canDelete = true,
}) => {
  const statusConfig = {
    pending: {
      label: "Pending",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: AlertCircle,
    },
    "in-progress": {
      label: "In Progress",
      color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      icon: PlayCircle,
    },
    completed: {
      label: "Completed",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle2,
    },
  };

  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const outcome = task.outcome ? CALL_OUTCOMES[task.outcome] : null;
  const callbackDue = isCallbackDue(task);

  const formattedDate = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently";

  return (
    <div
      className={`glass-panel rounded-xl p-4 border transition-all duration-200 relative group flex flex-col justify-between ${
        isSelected
          ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/10"
          : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40"
      }`}
    >
      <div>
        {/* Top Header: Checkbox + Customer + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect(task._id)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
              />
            )}
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                {task.firstName || "Customer Contact"}
              </h3>
              {task.phone && (
                <a
                  href={`tel:${task.phone}`}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  <span>{task.phone}</span>
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${status.color}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{status.label}</span>
            </span>
          </div>
        </div>

        {/* Category & Assignment */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <CategoryBadge
            category={task.category || "General"}
            source={task.categorySource}
            size="xs"
          />

          {task.agent?.name && (
            <span className="text-[11px] font-medium text-slate-400 truncate max-w-[120px]">
              Assigned: <span className="text-slate-300 font-semibold">{task.agent.name}</span>
            </span>
          )}
        </div>

        {/* Call Tracking: last outcome, attempts, scheduled callback */}
        {(outcome || hasOpenCallback(task)) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {outcome && (
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${outcome.color}`}>
                {outcome.label}
              </span>
            )}
            {task.attempts > 0 && (
              <span className="text-[11px] text-slate-500">
                {task.attempts} call{task.attempts > 1 ? "s" : ""}
              </span>
            )}
            {hasOpenCallback(task) && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                  callbackDue
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse"
                    : "bg-violet-500/10 text-violet-300 border-violet-500/30"
                }`}
              >
                <CalendarClock className="w-3 h-3" />
                {callbackDue ? "Callback due · " : ""}
                {formatCallbackTime(task.callbackAt)}
              </span>
            )}
          </div>
        )}

        {/* Task Notes Snippet */}
        <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/60 mb-3">
          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
            {task.notes || "No notes attached to this task."}
          </p>
        </div>
      </div>

      {/* Footer: Date & Actions */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60 text-xs">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formattedDate}</span>
        </span>

        <div className="flex items-center gap-1.5">
          {/* Status Quick Toggle */}
          {onStatusChange && (
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task._id, e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          )}

          {onLogCall && task.status !== "completed" && (
            <button
              onClick={() => onLogCall(task)}
              title="Log Call"
              className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
            </button>
          )}

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(task)}
              title="View Details"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              title="Edit Task"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {onDelete && canDelete && (
            <button
              onClick={() => onDelete(task._id)}
              title="Delete Task"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
