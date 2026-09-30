import React from "react";
import { AlertTriangle, X } from "lucide-react";

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 p-6 shadow-2xl relative">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDanger
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{message}</p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-lg transition-colors ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
