import React, { useState, useEffect } from "react";
import CategoryBadge from "../CategoryBadge";
import ActivityTimeline from "./ActivityTimeline";
import CallAssistPanel from "../knowledge/CallAssistPanel";
import { X, Phone, PhoneCall, User, Calendar, Sparkles, CalendarClock } from "lucide-react";
import { CALL_OUTCOMES, hasOpenCallback, isCallbackDue, formatCallbackTime } from "../../constants/callOutcomes";

const TaskModal = ({ task, isOpen, onClose, onStatusChange, onLogCall }) => {
  const [historyTab, setHistoryTab] = useState("activity"); // 'activity' | 'calls' | 'assist'

  useEffect(() => {
    if (isOpen) setHistoryTab("activity");
  }, [isOpen, task?._id]);

  if (!isOpen || !task) return null;

  // Newest call first
  const callLogs = [...(task.callLogs || [])].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <CategoryBadge category={task.category} source={task.categorySource} size="sm" />
              <span className="text-xs text-slate-400 capitalize">
                Status: <strong className="text-slate-200">{task.status}</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {task.firstName || "Task Details"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 text-sm">
          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Customer</span>
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {task.firstName || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Phone</span>
              {task.phone ? (
                <a
                  href={`tel:${task.phone}`}
                  className="text-sm font-semibold text-indigo-400 hover:underline flex items-center gap-1.5 mt-0.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {task.phone}
                </a>
              ) : (
                <span className="text-slate-400">N/A</span>
              )}
            </div>
          </div>

          {/* AI Metadata Box */}
          {task.categorySource === "ai" && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-indigo-300">Auto-Categorized by Gemini AI</p>
                <p className="text-slate-400 mt-0.5">
                  Classified into <strong>{task.category}</strong> based on semantic notes.
                </p>
              </div>
            </div>
          )}

          {/* Full Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Task Notes & Instructions
            </label>
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 text-slate-200 text-sm leading-relaxed max-h-48 overflow-y-auto">
              {task.notes || "No notes available for this task."}
            </div>
          </div>

          {/* Scheduled Callback */}
          {hasOpenCallback(task) && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                isCallbackDue(task)
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-violet-500/10 border-violet-500/30 text-violet-300"
              }`}
            >
              <CalendarClock className="w-4 h-4 flex-shrink-0" />
              <span>
                {isCallbackDue(task) ? "Callback overdue since " : "Callback scheduled for "}
                <strong>{formatCallbackTime(task.callbackAt)}</strong>
              </span>
            </div>
          )}

          {/* History: full activity timeline, or just the calls */}
          <div>
            <div className="flex items-center gap-1 mb-2.5">
              {[
                { key: "activity", label: "History" },
                { key: "calls", label: `Calls (${callLogs.length})` },
                ...(task.status !== "completed" ? [{ key: "assist", label: "✨ Call Assist" }] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setHistoryTab(tab.key)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg uppercase tracking-wider transition-colors ${
                    historyTab === tab.key ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {historyTab === "activity" ? (
              <ActivityTimeline taskId={task._id} refreshKey={task.updatedAt} />
            ) : historyTab === "assist" ? (
              <CallAssistPanel task={task} />
            ) : callLogs.length > 0 ? (
              <ol className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {callLogs.map((log, i) => {
                  const cfg = CALL_OUTCOMES[log.outcome];
                  return (
                    <li key={log._id || i} className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cfg?.color || ""}`}>
                          {cfg?.label || log.outcome}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {log.loggedByName ? `${log.loggedByName} · ` : ""}
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      {log.note && <p className="text-slate-300 mt-1.5 leading-relaxed">{log.note}</p>}
                      {log.callbackAt && (
                        <p className="text-violet-300/80 mt-1 text-[11px]">
                          Callback requested for {formatCallbackTime(log.callbackAt)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-xs text-slate-500">No calls logged yet.</p>
            )}
          </div>

          {/* Assigned Agent */}
          {task.agent && (
            <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <span>Assigned Agent:</span>
              <span className="font-semibold text-slate-200">{task.agent.name} ({task.agent.email})</span>
            </div>
          )}

          {/* Date Created */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Created: {task.createdAt ? new Date(task.createdAt).toLocaleString() : "Recently"}
            </span>
            {task.completedDate && (
              <span className="text-emerald-400 font-medium">
                Completed: {new Date(task.completedDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Change Status:</span>
            <div className="flex items-center gap-1.5">
              {["pending", "in-progress", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    onStatusChange(task._id, st);
                    onClose();
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                    task.status === st
                      ? "bg-indigo-600 text-white font-semibold"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLogCall && task.status !== "completed" && (
              <button
                onClick={() => {
                  onClose();
                  onLogCall(task);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Log Call
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
