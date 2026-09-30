import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { Sparkles, Lightbulb, MessageSquareWarning, ArrowRightCircle, FileText, Users, AlertCircle } from "lucide-react";
import CitedText from "./CitedText";

/**
 * AI talking points for one lead, from its history, similar converted leads and the knowledge base.
 * Only generated on demand, to spare the (shared, rate-limited) AI budget.
 */
const CallAssistPanel = ({ task }) => {
  const [assist, setAssist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Suggestions belong to one task; reset when switching tasks
  useEffect(() => {
    setAssist(null);
    setError(null);
  }, [task._id]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tasks/${task._id}/assist`);
      setAssist(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Call Assist is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  if (!assist) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-xs text-slate-400">
          Get talking points, likely objections and a suggested next step, based on this lead's history,
          similar leads that converted, and your knowledge base.
        </p>
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30"
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {loading ? "Thinking…" : "Generate suggestions"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
      {assist.summary && <p className="text-slate-300 italic">{assist.summary}</p>}

      {assist.nextAction && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <p className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
            <ArrowRightCircle className="w-3.5 h-3.5" /> Next best action
          </p>
          <CitedText text={assist.nextAction} className="text-slate-200" />
        </div>
      )}

      {assist.talkingPoints?.length > 0 && (
        <div>
          <p className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Talking points
          </p>
          <ul className="space-y-1.5 list-disc list-inside text-slate-300">
            {assist.talkingPoints.map((p, i) => (
              <li key={i}>
                <CitedText text={p} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {assist.likelyObjections?.length > 0 && (
        <div>
          <p className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
            <MessageSquareWarning className="w-3.5 h-3.5 text-rose-400" /> Likely objections
          </p>
          <div className="space-y-1.5">
            {assist.likelyObjections.map((o, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <p className="text-slate-200 font-medium">“{o.objection}”</p>
                {/* div, not p: CitedText renders block-level Markdown */}
                <div className="text-slate-400 mt-1 flex items-start gap-1">
                  <span>→</span>
                  <CitedText text={o.response} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(assist.sources?.length > 0 || assist.similarLeads?.length > 0) && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          {assist.sources?.map((s) => (
            <div key={s.ref} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="text-indigo-300 font-semibold">[{s.ref}]</span>
              <FileText className="w-3 h-3" />
              <span className="truncate">{s.title}</span>
            </div>
          ))}
          {assist.similarLeads?.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Users className="w-3 h-3" />
              Based on {assist.similarLeads.length} similar converted lead{assist.similarLeads.length > 1 ? "s" : ""}
              {assist.similarLeads.some((l) => l.firstName) &&
                ` (${assist.similarLeads.map((l) => l.firstName).filter(Boolean).join(", ")})`}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-600">AI suggestions can be wrong. Check prices and policies against the sources.</p>

      <button onClick={generate} disabled={loading} className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
        {loading ? "Regenerating…" : "Regenerate"}
      </button>
    </div>
  );
};

export default CallAssistPanel;
