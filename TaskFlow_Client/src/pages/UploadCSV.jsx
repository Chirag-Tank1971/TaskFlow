import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import { toast } from "react-toastify";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  ArrowRight,
  Download,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";

const UploadCSV = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    fetchUploadStats();
    fetchUploadHistory();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchUploadStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/upload/stats`);
      setUploadStats(res.data);
    } catch (err) {}
  };

  const fetchUploadHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/upload/history`);
      setUploadHistory(Array.isArray(res.data) ? res.data : res.data?.history || []);
    } catch (err) {}
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      setFile(droppedFile);
    } else {
      toast.error("Please drop a valid .csv file");
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith(".csv")) {
      setFile(selected);
    } else {
      toast.error("Please select a valid .csv file");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setUploading(true);
    setProgressData({
      status: "parsing",
      currentStep: "Uploading file and parsing structure...",
      progress: 5,
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { jobId } = res.data;

      if (jobId) {
        // Live polling with Axios (automatically attaches Authorization headers & cookies)
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
          try {
            const progRes = await axios.get(`${API_BASE_URL}/api/upload/progress/${jobId}`);
            const data = progRes.data;
            setProgressData(data);

            if (data.status === "completed") {
              clearInterval(pollIntervalRef.current);
              toast.success("Tasks processed, categorized, and distributed!");
              setUploading(false);
              setFile(null);
              fetchUploadStats();
              fetchUploadHistory();
            } else if (data.status === "failed") {
              clearInterval(pollIntervalRef.current);
              toast.error(data.error || "Upload processing failed");
              setUploading(false);
            }
          } catch (pollErr) {
            console.warn("Progress poll retry:", pollErr.message);
          }
        }, 600);
      } else {
        toast.success("File uploaded successfully");
        setUploading(false);
        setFile(null);
        fetchUploadStats();
        fetchUploadHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "File upload failed");
      setUploading(false);
      setProgressData(null);
    }
  };

  // Sample CSV generator for user convenience
  const downloadSampleCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,FirstName,Phone,Notes\n" +
      "Alice Smith,555-0101,Customer inquired about enterprise billing and invoice clarification\n" +
      "Bob Johnson,555-0102,Critical server outage reported on US-East-1 datacenter node\n" +
      "Carla Davis,555-0103,Requested product demo for sales team of 50 users\n" +
      "David Miller,555-0104,Customer cannot reset password on authentication portal\n" +
      "Elena Rostova,555-0105,Need feedback on recent support ticket resolution";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "taskflow_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout
      title="Batch Task Ingestion & AI Categorization"
      subtitle="Upload bulk CSV work orders to automatically classify categories with Gemini AI and distribute round-robin to agents"
      action={
        <button
          onClick={downloadSampleCSV}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Download Sample CSV</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Column: Dropzone & Upload Action */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`glass-panel rounded-2xl p-8 border-2 border-dashed transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[260px] relative ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                : file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              disabled={uploading}
            />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{file.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB &bull; Ready for AI processing
                  </p>
                </div>
                <span className="text-xs text-indigo-400 font-medium hover:underline">
                  Click or drag to replace file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Drop your CSV file here, or browse
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports columns: <strong>FirstName, Phone, Notes</strong>
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition-colors">
                  Choose CSV File
                </span>
              </div>
            )}
          </div>

          {/* Real-time Progress Bar */}
          {uploading && progressData && (
            <div className="glass-panel rounded-2xl p-6 border border-indigo-500/30 shadow-xl bg-indigo-950/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs font-bold text-white">
                    {progressData.currentStep || "Processing..."}
                  </span>
                </div>
                <span className="text-xs font-bold text-indigo-400">
                  {progressData.progress || 0}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 mb-3">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressData.progress || 5}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Categorized: <strong>{progressData.categorizedTasks || 0}</strong>
                </span>
                <span>
                  Processed: <strong>{progressData.processedTasks || 0}</strong>
                </span>
                {progressData.rateLimitHit && (
                  <span className="text-amber-400 font-medium">Rate limit protection applied</span>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing AI Categorization & Distribution...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Upload & Distribute Tasks with AI</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Processing Pipeline Info & Stats */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Automated AI Pipeline
            </h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-white">Stream Parsing</h4>
                  <p className="text-slate-400 mt-0.5">
                    CSV rows are validated against FirstName, Phone, and Notes schema.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-white">Gemini Categorization</h4>
                  <p className="text-slate-400 mt-0.5">
                    Analyzes intent into Support, Sales, Tech, Billing, or Urgent.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-white">Round-Robin Assignment</h4>
                  <p className="text-slate-400 mt-0.5">
                    Equally distributed across all agents currently marked as Available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload History Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-slate-400" />
          Recent Ingestion Batches
        </h3>

        {uploadHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="pb-3 font-semibold">File Name</th>
                  <th className="pb-3 font-semibold">Rows Ingested</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Processing Duration</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {uploadHistory.slice(0, 8).map((u, idx) => (
                  <tr key={u._id || `upload-row-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>{u.filename}</span>
                    </td>
                    <td className="py-3">{u.tasksCreated || u.rowCount || 0} tasks</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          u.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : u.status === "processing"
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {u.processingTime ? `${(u.processingTime / 1000).toFixed(1)}s` : "Instant"}
                    </td>
                    <td className="py-3 text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Recent"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            No previous uploads found.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UploadCSV;
