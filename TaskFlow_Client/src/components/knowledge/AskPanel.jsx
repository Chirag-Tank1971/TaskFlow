import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { BookOpen, X, Send, FileText, AlertCircle, Sparkles, Database, Trash2 } from "lucide-react";
import CitedText from "./CitedText";
import DataResult from "../data/DataResult";
import { useAuth } from "../../context/AuthContext";
import { STORAGE_PREFIX, loadSaved, saveState } from "./askPanelStorage";
import AiLauncher from "./AiLauncher";

/**
 * Modes of the assistant:
 * - knowledge: answers only from uploaded documents, with numbered sources (everyone)
 * - data: read-only questions about TaskFlow data, answered as tables (admins/managers only)
 */
const MODES = {
  knowledge: {
    label: "Knowledge Base",
    icon: BookOpen,
    subtitle: "Answers only from your company's documents",
    placeholder: "Ask about products, policies, scripts…",
    loadingText: "Searching documents…",
    intro: "Ask about products, pricing, policies or call scripts.",
    examples: ["What is our refund policy?", "How do I handle a pricing objection?"],
  },
  data: {
    label: "Your Data",
    icon: Database,
    subtitle: "Read-only: looks things up, never changes them",
    placeholder: "e.g. Show urgent tasks assigned to Priya",
    loadingText: "Querying your data…",
    intro: "Ask about tasks, agents, callbacks, activity or uploads.",
    examples: [
      "Show urgent tasks",
      "Which callbacks are overdue?",
      "How many leads did each agent convert this week?",
      "Leads not called in 3 days",
      "Who has the most open tasks?",
    ],
  },
};

const AskPanel = () => {
  const { isAdmin, user } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${user?._id || user?.id || "anon"}`;
  const [saved] = useState(() => loadSaved(storageKey));

  const [open, setOpen] = useState(saved?.open ?? false);
  const [mode, setMode] = useState(saved?.mode ?? "knowledge");
  const [question, setQuestion] = useState(saved?.question ?? "");
  // Separate conversation per mode: { role: 'user'|'assistant'|'data'|'error', text?, sources?, result? }
  const [history, setHistory] = useState(saved?.history ?? { knowledge: [], data: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveState(storageKey, { open, mode, question, history });
  }, [storageKey, open, mode, question, history]);
  const [highlight, setHighlight] = useState(null); // `${messageIndex}:${ref}`
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const activeMode = isAdmin ? mode : "knowledge"; // agents only get the knowledge base
  const cfg = MODES[activeMode];
  const messages = history[activeMode];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, activeMode]);

  const push = (m, entry) => setHistory((h) => ({ ...h, [m]: [...h[m], entry] }));

  const ask = async (e, preset) => {
    e?.preventDefault();
    const q = (preset ?? question).trim();
    if (q.length < 3 || loading) return;

    const m = activeMode; // capture: the user might switch modes while waiting
    push(m, { role: "user", text: q });
    setQuestion("");
    setLoading(true);
    try {
      if (m === "data") {
        const res = await axios.post(`${API_BASE_URL}/api/data/ask`, {
          question: q,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        push(m, { role: "data", result: res.data });
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/knowledge/ask`, { question: q });
        push(m, { role: "assistant", text: res.data.answer, sources: res.data.sources || [], answered: res.data.answered });
      }
    } catch (err) {
      push(m, {
        role: "error",
        text: err.response?.data?.message || (m === "data" ? "The data assistant is unavailable right now." : "Could not reach the knowledge base."),
      });
    } finally {
      setLoading(false);
    }
  };

  const ModeIcon = cfg.icon;

  return (
    <>
      {/* Launcher (bottom-left, so it doesn't collide with toasts on the right) */}
      {/* greetedKey shares the panel's storage prefix, so logout resets the post-login peek */}
      {!open && <AiLauncher onClick={() => setOpen(true)} greetedKey={`${storageKey}:greeted`} />}

      {open && (
        <div
          className={`fixed bottom-5 left-5 z-50 w-[calc(100vw-2.5rem)] h-[75vh] max-h-[680px] glass-panel rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col bg-[#0B1120]/95 backdrop-blur-xl animate-fadeIn transition-[max-width] ${
            activeMode === "data" ? "max-w-md sm:max-w-2xl" : "max-w-md sm:max-w-lg"
          }`}
        >
          <div className="px-4 pt-3.5 pb-3 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  TaskFlow AI
                </h2>
                <p className="text-[11px] text-slate-500">{cfg.subtitle}</p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => setHistory((h) => ({ ...h, [activeMode]: [] }))}
                    disabled={loading}
                    title={`Clear ${cfg.label} conversation`}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  title="Minimize (your conversation is kept)"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode switch (data mode is admin/manager only) */}
            {isAdmin && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
                {Object.entries(MODES).map(([key, m]) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        activeMode === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
            {messages.length === 0 && (
              <div className="text-xs text-slate-500 space-y-3 pt-6 text-center">
                <ModeIcon className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-medium">{cfg.intro}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {cfg.examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => ask(null, ex)}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20">
                    {m.text}
                  </div>
                </div>
              ) : m.role === "error" ? (
                <div key={i} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <span>{m.text}</span>
                </div>
              ) : m.role === "data" ? (
                <div key={i} className="px-3.5 py-3 rounded-2xl rounded-bl-sm border bg-slate-900/90 border-slate-800/90 shadow-sm">
                  <DataResult result={m.result} />
                </div>
              ) : (
                <div key={i} className="space-y-2.5">
                  <div
                    className={`px-4 py-3.5 rounded-2xl rounded-bl-sm text-xs border shadow-sm ${
                      m.answered
                        ? "bg-slate-900/90 border-slate-800/90 text-slate-200"
                        : "bg-amber-500/10 border-amber-500/25 text-amber-200/95"
                    }`}
                  >
                    <CitedText text={m.text} onCite={(ref) => setHighlight(`${i}:${ref}`)} />
                  </div>
                  {m.sources?.length > 0 && (
                    <div className="space-y-1.5 pt-1 pl-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Referenced Sources
                      </div>
                      {m.sources.map((s) => (
                        <div
                          key={s.ref}
                          className={`px-3 py-2 rounded-xl border text-[11px] transition-all duration-200 ${
                            highlight === `${i}:${s.ref}`
                              ? "bg-indigo-500/20 border-indigo-500/60 ring-1 ring-indigo-500/40 shadow-sm"
                              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded bg-indigo-500/30 text-indigo-300">
                              [{s.ref}]
                            </span>
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{s.title}</span>
                          </div>
                          <p className="text-slate-400 mt-1 line-clamp-2 leading-relaxed">{s.snippet}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-3.5 h-3.5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                {cfg.loadingText}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={ask} className="p-3 border-t border-slate-800 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              maxLength={activeMode === "data" ? 500 : 1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={cfg.placeholder}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || question.trim().length < 3}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
              title="Ask"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AskPanel;
