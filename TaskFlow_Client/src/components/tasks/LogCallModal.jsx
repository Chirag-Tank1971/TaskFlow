import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { toast } from "react-toastify";
import { X, PhoneCall, Phone } from "lucide-react";
import { CALL_OUTCOMES } from "../../constants/callOutcomes";

// Format a Date for <input type="datetime-local"> in the user's local time
const toLocalInput = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const presetTimes = () => {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(10, 0, 0, 0);
  const inThreeDays = new Date(tomorrowMorning);
  inThreeDays.setDate(tomorrowMorning.getDate() + 2);
  return [
    { label: "In 1 hour", value: inOneHour },
    { label: "Tomorrow 10:00", value: tomorrowMorning },
    { label: "In 3 days", value: inThreeDays },
  ];
};

const LogCallModal = ({ task, isOpen, onClose, onLogged }) => {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOutcome("");
      setNote("");
      setCallbackAt("");
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outcome) {
      toast.error("Choose the call outcome");
      return;
    }
    if (outcome === "callback" && !callbackAt) {
      toast.error("Pick when to call back");
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tasks/${task._id}/calls`, {
        outcome,
        note,
        ...(outcome === "callback" && { callbackAt: new Date(callbackAt).toISOString() }),
      });
      toast.success(`Call logged: ${CALL_OUTCOMES[outcome].label}`);
      onLogged(res.data.task);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log call");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-indigo-400" />
              Log Call
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {task.firstName || "Customer"}
              {task.phone && (
                <>
                  {" · "}
                  <a href={`tel:${task.phone}`} className="text-indigo-400 hover:underline inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {task.phone}
                  </a>
                </>
              )}
              {task.attempts > 0 && ` · ${task.attempts} previous attempt${task.attempts > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">Outcome *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(CALL_OUTCOMES).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutcome(key)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    outcome === key
                      ? `${cfg.color} ring-2 ring-indigo-500/60`
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
            {outcome && CALL_OUTCOMES[outcome].closes && (
              <p className="text-[11px] text-slate-500 mt-2">This outcome closes the task as completed.</p>
            )}
          </div>

          {outcome === "callback" && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Call back at *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {presetTimes().map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setCallbackAt(toLocalInput(p.value))}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                required
                min={toLocalInput(new Date())}
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors shadow-inner [color-scheme:dark]"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Call note</label>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="What was discussed? Anything to remember next time?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner resize-y"
            />
          </div>

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
              disabled={saving || !outcome}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-colors"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <PhoneCall className="w-3.5 h-3.5" />
              )}
              <span>Save Call</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogCallModal;
