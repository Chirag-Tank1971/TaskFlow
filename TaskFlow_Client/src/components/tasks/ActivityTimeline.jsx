import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { ACTIVITY_TYPES, describeActivity, actorLabel, timeAgo } from "../../constants/activityTypes";

/**
 * Chronological history of one task (newest first).
 * `refreshKey` should change whenever the task changes so the timeline reloads.
 */
const ActivityTimeline = ({ taskId, refreshKey }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(`${API_BASE_URL}/api/tasks/${taskId}/activity`)
      .then((res) => !cancelled && setActivities(res.data?.activities || []))
      .catch((err) => !cancelled && setError(err.response?.data?.message || "Could not load history"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey]);

  if (loading) {
    return (
      <div className="py-4 flex justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) return <p className="text-xs text-rose-400">{error}</p>;

  if (activities.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No history recorded yet. Changes made from now on will appear here.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-slate-800 ml-2.5 space-y-3 max-h-64 overflow-y-auto pr-1">
      {activities.map((a) => {
        const cfg = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.updated;
        const Icon = cfg.icon;
        return (
          <li key={a._id} className="ml-5">
            <span
              className={`absolute -left-[11px] w-[22px] h-[22px] rounded-full border flex items-center justify-center ${cfg.color}`}
            >
              <Icon className="w-3 h-3" />
            </span>
            <div className="text-xs leading-relaxed">
              <span className="font-semibold text-slate-200">{actorLabel(a.actor)}</span>{" "}
              <span className="text-slate-400">{describeActivity(a)}</span>
            </div>
            {a.type === "call_logged" && a.meta?.note && (
              <p className="mt-1 p-2 bg-slate-900/70 rounded-lg border border-slate-800 text-xs text-slate-300">
                {a.meta.note}
              </p>
            )}
            <span className="text-[11px] text-slate-500" title={new Date(a.createdAt).toLocaleString()}>
              {timeAgo(a.createdAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default ActivityTimeline;
