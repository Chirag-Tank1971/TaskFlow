import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../../context/SocketContext";
import { Users, UserCheck, Wifi } from "lucide-react";

const PresenceChip = () => {
  const { isConnected, onlineAgentCount, activeAgents } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        title={isConnected ? "View active team members" : "Reconnecting to real-time server"}
        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-200 focus:outline-none shrink-0 ${
          isConnected
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20"
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? "bg-emerald-500" : "bg-amber-500"
            }`}
          ></span>
        </span>
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold tabular-nums text-[11px] whitespace-nowrap">
          {isConnected ? `${onlineAgentCount} Live` : "Connecting..."}
        </span>
      </motion.button>

      {/* Popover / Dropdown Menu with Spring Animation */}
      <AnimatePresence>
        {isOpen && isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 py-3 z-50 backdrop-blur-xl"
          >
          <div className="px-3.5 pb-2.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Team</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              {onlineAgentCount} {onlineAgentCount === 1 ? "agent" : "agents"} online
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 px-1 py-1">
            {activeAgents.length > 0 ? (
              activeAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-800/50 rounded-xl transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {agent.name ? agent.name.slice(0, 2).toUpperCase() : "AG"}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-200 truncate leading-tight">
                      {agent.name || agent.email}
                    </span>
                    <span className="text-[10px] text-cyan-400 truncate leading-tight flex items-center gap-1">
                      <UserCheck className="w-2.5 h-2.5" />
                      Agent
                    </span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-slate-500">
                No agents online right now.
              </div>
            )}
          </div>
          <div className="px-3.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>Real-time presence via Socket.io</span>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PresenceChip;
