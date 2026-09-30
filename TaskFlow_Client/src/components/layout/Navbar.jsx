import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  BarChart3,
  CheckSquare,
  LogOut,
  Sparkles,
  Menu,
  X,
  UserCheck,
  Shield,
  History,
  BookOpen,
} from "lucide-react";

const Navbar = () => {
  const { user, logout, isAdmin, isAgent } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const adminNavItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Tasks", path: "/tasks", icon: CheckSquare },
    { label: "Agents", path: "/agents", icon: Users },
    { label: "Upload Tasks", path: "/upload", icon: UploadCloud },
    { label: "Analytics", path: "/analytics", icon: BarChart3 },
    { label: "Activity", path: "/activity", icon: History },
    { label: "Knowledge", path: "/knowledge", icon: BookOpen },
  ];

  const agentNavItems = [
    { label: "Agent Home", path: "/agent/dashboard", icon: LayoutDashboard },
    { label: "My Tasks", path: "/agent/tasks", icon: CheckSquare },
  ];

  const navItems = isAdmin ? adminNavItems : agentNavItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#090D16]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center shrink-0">
            <Link
              to={isAdmin ? "/dashboard" : "/agent/dashboard"}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-md shadow-indigo-500/20 ring-1 ring-white/10 group-hover:scale-105 group-hover:shadow-indigo-500/30 transition-all duration-200">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                  TaskFlow
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  PRO
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links - Modern Floating Segmented Pill */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/70 p-1 lg:p-1.5 rounded-full border border-slate-800/80 shadow-inner shadow-black/30 backdrop-blur-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap flex items-center gap-2 px-3 lg:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Status Beacon + User Profile Pill + Logout */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {/* AI Status Badge */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="whitespace-nowrap font-medium text-[11px] tracking-wide">Gemini AI Active</span>
            </div>

            <div className="hidden xl:block h-5 w-px bg-slate-800/80" />

            {/* User Profile Card / Chip */}
            <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-inner">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "TF"}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px] leading-tight">
                  {user?.name || "User"}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider leading-tight">
                  {isAdmin ? (
                    <span className="text-indigo-400 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  ) : (
                    <span className="text-cyan-400 flex items-center gap-0.5">
                      <UserCheck className="w-2.5 h-2.5" />
                      Agent
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/80 hover:border-rose-500/30 transition-all duration-150 focus:outline-none"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800/80 space-y-1.5">
            {/* AI Status in Mobile */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-400">Gemini AI Active</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3.5 mt-2 border-t border-slate-800/80 flex items-center justify-between px-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "TF"}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">{user?.name || "User"}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                    {isAdmin ? "Admin" : "Agent"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
