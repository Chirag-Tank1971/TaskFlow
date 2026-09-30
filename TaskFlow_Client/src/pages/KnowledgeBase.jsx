import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import ConfirmModal from "../components/common/ConfirmModal";
import { toast } from "react-toastify";
import {
  BookOpen,
  UploadCloud,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HelpCircle,
  Database,
} from "lucide-react";
import { timeAgo } from "../constants/activityTypes";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

const statusBadge = {
  ready: { label: "Ready", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  processing: { label: "Indexing…", icon: Loader2, cls: "bg-sky-500/10 text-sky-400 border-sky-500/20", spin: true },
  failed: { label: "Failed", icon: AlertTriangle, cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil((bytes || 0) / 1024)} KB`);

const KnowledgeBase = () => {
  const [documents, setDocuments] = useState([]);
  const [chromaUp, setChromaUp] = useState(true);
  const [chromaError, setChromaError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [queries, setQueries] = useState([]);
  const [queryStats, setQueryStats] = useState({ total: 0, unanswered: 0 });
  const [unansweredOnly, setUnansweredOnly] = useState(true);

  const fetchDocuments = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/knowledge/documents`);
      setDocuments(res.data.documents || []);
      setChromaUp(res.data.chromaUp !== false);
      setChromaError(res.data.chromaError || null);
    } catch (err) {
      if (!quiet) toast.error(err.response?.data?.message || "Failed to load documents");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const fetchQueries = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/knowledge/queries`, {
        params: unansweredOnly ? { unanswered: "true" } : {},
      });
      setQueries(res.data.queries || []);
      setQueryStats(res.data.stats || { total: 0, unanswered: 0 });
    } catch {
      /* non-critical panel */
    }
  }, [unansweredOnly]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Poll while any document is still being indexed
  const anyProcessing = documents.some((d) => d.status === "processing");
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(() => fetchDocuments(true), 3000);
    return () => clearInterval(timer);
  }, [anyProcessing, fetchDocuments]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim() || file.name);
    form.append("audience", audience);

    setUploading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/knowledge/documents`, form);
      toast.success(res.data.message);
      setDocuments((prev) => [res.data.document, ...prev]);
      setFile(null);
      setTitle("");
      setAudience("all");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/knowledge/documents/${deleteTarget._id}`);
      toast.success(res.data.message);
      setDocuments((prev) => prev.filter((d) => d._id !== deleteTarget._id));
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  };

  const readyCount = documents.filter((d) => d.status === "ready").length;
  const chunkTotal = documents.reduce((sum, d) => sum + (d.status === "ready" ? d.chunkCount || 0 : 0), 0);

  return (
    <AppLayout
      title="Knowledge Base"
      subtitle="Documents agents can ask about. Answers are generated only from what you upload here."
      action={
        <button
          onClick={() => {
            fetchDocuments();
            fetchQueries();
          }}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {!chromaUp && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-200">
          <Database className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm text-white">Knowledge base unavailable (Chroma Cloud)</p>
            <p className="mt-1">
              {chromaError || "Can't connect to Chroma Cloud."} Uploads and questions won't work until this is fixed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upload */}
        <form onSubmit={handleUpload} className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-3.5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            Add a document
          </h2>

          <label className="block border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors">
            <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handleFileChange} className="hidden" />
            <FileText className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
            <span className="text-xs text-slate-300 font-medium block truncate">{file ? file.name : "Choose PDF, DOCX, TXT or Markdown"}</span>
            <span className="text-[11px] text-slate-500">{file ? formatSize(file.size) : "Max 10 MB · text-based PDFs only"}</span>
          </label>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Title</label>
            <input
              type="text"
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Refund Policy 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Who can see answers from it</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Everyone (agents and managers)</option>
              <option value="managers">Managers and admins only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={uploading || !file || !chromaUp}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-colors"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            Upload &amp; Index
          </button>
        </form>

        {/* Documents */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Documents
            </h2>
            <span className="text-[11px] text-slate-500">
              {readyCount} ready · {chunkTotal} searchable passages
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No documents yet. Upload your product sheets, policies and call scripts.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {documents.map((d) => {
                const badge = statusBadge[d.status] || statusBadge.processing;
                const BadgeIcon = badge.icon;
                return (
                  <li key={d._id} className="px-5 py-3.5 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200 truncate">{d.title}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${badge.cls}`}>
                          <BadgeIcon className={`w-3 h-3 ${badge.spin ? "animate-spin" : ""}`} />
                          {badge.label}
                        </span>
                        {d.audience === "managers" && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/20">
                            Managers only
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {d.filename} · {formatSize(d.size)}
                        {d.status === "ready" && ` · ${d.chunkCount} passages`}
                        {d.uploadedBy?.name && ` · ${d.uploadedBy.name}`} · {timeAgo(d.createdAt)}
                      </p>
                      {d.status === "failed" && d.error && <p className="text-[11px] text-rose-400 mt-0.5">{d.error}</p>}
                    </div>
                    <button
                      onClick={() => setDeleteTarget(d)}
                      disabled={d.status === "processing"}
                      title="Remove document"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Questions agents asked */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Questions asked
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {queryStats.total} total · {queryStats.unanswered} the knowledge base couldn't answer. Unanswered questions show which documents to add.
            </p>
          </div>
          <div className="glass-panel p-1 rounded-xl flex items-center gap-1 border border-slate-800">
            {[
              { v: true, label: "Unanswered" },
              { v: false, label: "All" },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setUnansweredOnly(opt.v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  unansweredOnly === opt.v ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {queries.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            {unansweredOnly ? "No unanswered questions. Nice!" : "No questions asked yet."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {queries.map((q) => (
              <li key={q._id} className="px-5 py-3 flex items-start gap-3 text-xs">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${q.answered ? "bg-emerald-400" : "bg-amber-400"}`}
                  title={q.answered ? "Answered" : "Not answered"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200">{q.question}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {q.askedBy?.name || "Someone"} ({q.askedBy?.role}) · {timeAgo(q.createdAt)}
                    {q.latencyMs ? ` · ${(q.latencyMs / 1000).toFixed(1)}s` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Document"
        message={`Remove "${deleteTarget?.title}" from the knowledge base? Agents will no longer get answers from it.`}
        confirmText="Remove"
        isDanger={true}
      />
    </AppLayout>
  );
};

export default KnowledgeBase;
