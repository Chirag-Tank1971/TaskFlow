import React from "react";

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "indigo" }) => {
  const colorMap = {
    indigo: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/20",
      glow: "hover:border-indigo-500/40",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      glow: "hover:border-emerald-500/40",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      glow: "hover:border-amber-500/40",
    },
    violet: {
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      border: "border-violet-500/20",
      glow: "hover:border-violet-500/40",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      glow: "hover:border-rose-500/40",
    },
    sky: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/20",
      glow: "hover:border-sky-500/40",
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-slate-800/80 ${scheme.glow} transition-all duration-200 shadow-lg relative overflow-hidden group`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-9 h-9 rounded-xl ${scheme.bg} ${scheme.border} border flex items-center justify-center ${scheme.text} group-hover:scale-110 transition-transform`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {value}
        </span>
        {trend && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-400 flex items-center gap-1 font-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
