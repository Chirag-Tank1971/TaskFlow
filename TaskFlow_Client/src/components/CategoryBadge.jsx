import React from "react";
import {
  Headphones,
  TrendingUp,
  Wrench,
  CreditCard,
  AlertTriangle,
  Tag,
  Sparkles,
} from "lucide-react";

const CategoryBadge = ({ category, source, size = "sm" }) => {
  const getCategoryConfig = (cat) => {
    const configs = {
      Support: {
        icon: Headphones,
        color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        label: "Support",
      },
      Sales: {
        icon: TrendingUp,
        color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        label: "Sales",
      },
      Technical: {
        icon: Wrench,
        color: "bg-violet-500/15 text-violet-400 border-violet-500/30",
        label: "Technical",
      },
      Billing: {
        icon: CreditCard,
        color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        label: "Billing",
      },
      Urgent: {
        icon: AlertTriangle,
        color: "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse",
        label: "Urgent",
      },
      General: {
        icon: Tag,
        color: "bg-slate-500/15 text-slate-300 border-slate-500/30",
        label: "General",
      },
    };
    return configs[cat] || configs.General;
  };

  const config = getCategoryConfig(category);
  const Icon = config.icon;

  const sizeClasses = {
    xs: "px-2 py-0.5 text-[10px]",
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.color} ${sizeClasses[size]}`}
      >
        <Icon className={size === "xs" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
        <span>{config.label}</span>
      </span>

      {source === "ai" && (
        <span
          title="Categorized by Gemini AI"
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full"
        >
          <Sparkles className="w-2.5 h-2.5 mr-0.5 text-indigo-400" />
          AI
        </span>
      )}
    </div>
  );
};

export default CategoryBadge;
