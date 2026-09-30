import React from "react";
import Navbar from "./Navbar";

const AppLayout = ({ children, title, subtitle, action }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100 relative selection:bg-indigo-500 selection:text-white">
      {/* Background ambient lighting gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-[128px]"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]"></div>
      </div>

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {(title || subtitle || action) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              {title && (
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-slate-400 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
            {action && <div className="flex items-center gap-3">{action}</div>}
          </div>
        )}

        {children}
      </main>

      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 relative z-10">
        TaskFlow Intelligent Operations &bull; Powered by Google Gemini AI &bull; Production v2.0
      </footer>
    </div>
  );
};

export default AppLayout;
