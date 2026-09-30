import React from "react";
import { Filter, X } from "lucide-react";

const CATEGORIES = ["All", "Support", "Sales", "Technical", "Billing", "Urgent", "General"];

const CategoryFilter = ({ selectedCategory = "All", onCategoryChange, theme = "admin" }) => {
  return (
    <div className="glass-panel rounded-xl p-3.5 border border-slate-800/80 shadow-md">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            AI Categories
          </span>
        </div>
        {selectedCategory !== "All" && (
          <button
            onClick={() => onCategoryChange("All")}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/60"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilter;
