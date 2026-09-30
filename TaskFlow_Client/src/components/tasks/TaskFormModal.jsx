import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { toast } from "react-toastify";
import { X, Save, Sparkles } from "lucide-react";

const CATEGORIES = ["Support", "Sales", "Technical", "Billing", "Urgent", "General"];

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner disabled:opacity-50 disabled:cursor-not-allowed";
const labelClass = "text-xs font-semibold text-slate-300 block mb-1";

/**
 * Create a new task (task = null) or edit an existing one.
 * Agents (isAdmin = false) can only edit notes and status.
 */
const TaskFormModal = ({ isOpen, task, agents = [], isAdmin, onClose, onSaved }) => {
  const isEdit = !!task;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      firstName: task?.firstName || "",
      phone: task?.phone || "",
      notes: task?.notes || "",
      agent: task?.agent?._id || task?.agent || "",
      category: isEdit ? task.category || "General" : "",
      status: task?.status || "pending",
    });
  }, [isOpen, task, isEdit]);

  if (!isOpen) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Only send what changed on edit; drop empty "auto" choices on create
  const buildPayload = () => {
    const fields = isAdmin ? ["firstName", "phone", "notes", "agent", "category", "status"] : ["notes", "status"];
    const payload = {};
    fields.forEach((f) => {
      if (isEdit) {
        const original = f === "agent" ? task.agent?._id || task.agent || "" : task[f] ?? "";
        if (form[f] !== original && !(f === "agent" && !form[f])) payload[f] = form[f];
      } else if (f !== "status" && form[f] !== "") {
        payload[f] = form[f];
      }
    });
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload();

    if (isEdit && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = isEdit
        ? await axios.patch(`${API_BASE_URL}/api/tasks/${task._id}`, payload)
        : await axios.post(`${API_BASE_URL}/api/tasks`, payload);
      toast.success(res.data?.message || (isEdit ? "Task updated" : "Task created"));
      onSaved(res.data.task, isEdit);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const assignableAgents = agents.filter(
    (a) => a.status !== "Decommissioned" || a._id === form.agent
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isEdit ? "Edit Task" : "New Task"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit
                ? isAdmin
                  ? "Update details or reassign this task"
                  : "Update your notes and progress"
                : "Add a single lead without uploading a CSV"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Customer Name *</label>
              <input
                type="text"
                required
                maxLength={100}
                disabled={!isAdmin}
                placeholder="e.g. Priya Sharma"
                value={form.firstName || ""}
                onChange={set("firstName")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                maxLength={30}
                disabled={!isAdmin}
                placeholder="+91 98765 43210"
                value={form.phone || ""}
                onChange={set("phone")}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              rows={4}
              maxLength={2000}
              placeholder="What is this lead about?"
              value={form.notes || ""}
              onChange={set("notes")}
              className={`${inputClass} resize-y`}
            />
            <span className="text-[11px] text-slate-500">{(form.notes || "").length}/2000</span>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Assigned Agent</label>
                <select value={form.agent || ""} onChange={set("agent")} className={inputClass}>
                  {!isEdit && <option value="">Auto-assign (lightest workload)</option>}
                  {assignableAgents.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} {a.status !== "Available" ? `(${a.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select value={form.category || ""} onChange={set("category")} className={inputClass}>
                  {!isEdit && <option value="">Auto (AI from notes)</option>}
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isEdit && (
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={set("status")} className={inputClass}>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          {!isEdit && isAdmin && !form.category && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              Gemini will categorize this task from its notes shortly after it is saved.
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-colors"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isEdit ? "Save Changes" : "Create Task"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskFormModal;
