import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import PresenceChip from "../common/PresenceChip";

const Navbar = () => {
  const { user, logout, isAdmin, isAgent } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [logoutHovered, setLogoutHovered] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const adminNavItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Tasks",     path: "/tasks",     icon: CheckSquare },
    { label: "Agents",    path: "/agents",    icon: Users },
    { label: "Upload",    path: "/upload",    icon: UploadCloud },
    { label: "Analytics", path: "/analytics", icon: BarChart3 },
    { label: "Activity",  path: "/activity",  icon: History },
    { label: "Knowledge", path: "/knowledge", icon: BookOpen },
  ];

  const agentNavItems = [
    { label: "Home",     path: "/agent/dashboard", icon: LayoutDashboard },
    { label: "My Tasks", path: "/agent/tasks",      icon: CheckSquare },
  ];

  const navItems = isAdmin ? adminNavItems : agentNavItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#090D16]/85 backdrop-blur-xl transition-all">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">

          {/* ── Logo ─────────────────────────────────────────── */}
          <div className="flex items-center shrink-0">
            <Link
              to={isAdmin ? "/dashboard" : "/agent/dashboard"}
              className="flex items-center gap-2 group focus:outline-none"
            >
              <motion.div
                whileHover={{ scale: 1.06, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-md shadow-indigo-500/20 ring-1 ring-white/10 shrink-0"
              >
                <CheckSquare className="w-4 h-4 text-white" />
              </motion.div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                  TaskFlow
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  PRO
                </span>
              </div>
            </Link>
          </div>

          {/* ── Desktop Nav (Framer Motion Gliding Pills + Spring Unfolding) ─ */}
          <div className="hidden md:flex flex-1 justify-center px-1 sm:px-2 min-w-0">
            <nav
              onMouseLeave={() => setHoveredNav(null)}
              className="relative flex items-center gap-1 bg-slate-900/80 p-1 rounded-full border border-slate-800/80 shadow-inner shadow-black/40 backdrop-blur-md shrink-0"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isHovered = hoveredNav === item.path;
                const isExpanded = isActive || isHovered;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    onMouseEnter={() => setHoveredNav(item.path)}
                    className="relative flex items-center px-3 py-1.5 rounded-full text-xs font-medium focus:outline-none select-none z-10"
                  >
                    {/* Active Pill: Glides across tabs with spring physics */}
                    {isActive && (
                      <motion.div
                        layoutId="navbar-active-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 shadow-md shadow-indigo-600/35 z-0"
                      />
                    )}

                    {/* Hover Pill: Gliding hover indicator for inactive tabs */}
                    {!isActive && isHovered && (
                      <motion.div
                        layoutId="navbar-hover-pill"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-slate-800/80 border border-slate-700/50 z-0"
                      />
                    )}

                    {/* Icon with micro-spring animation */}
                    <motion.div
                      animate={{
                        scale: isHovered ? 1.15 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`relative z-10 shrink-0 ${
                        isActive
                          ? "text-white"
                          : isHovered
                          ? "text-indigo-300"
                          : "text-slate-400"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </motion.div>

                    {/* Label: Unfolds with buttery spring physics */}
                    <motion.span
                      initial={false}
                      animate={{
                        width: isExpanded ? "auto" : 0,
                        opacity: isExpanded ? 1 : 0,
                        marginLeft: isExpanded ? 6 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 360,
                        damping: 27,
                        mass: 0.7,
                      }}
                      className={`relative z-10 overflow-hidden whitespace-nowrap text-xs ${
                        isActive
                          ? "font-semibold text-white"
                          : isHovered
                          ? "font-medium text-slate-100"
                          : "font-medium text-slate-400"
                      }`}
                    >
                      {item.label}
                    </motion.span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── Desktop Right Section ────────────────────────── */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Live presence chip */}
            <PresenceChip />

            {/* AI Active badge — 2xl+ only */}
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Sparkles className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap font-medium text-[11px] tracking-wide">AI Active</span>
            </div>

            {/* User profile chip */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group flex items-center pl-1.5 pr-2 sm:pr-2.5 py-1 rounded-full bg-slate-900/70 hover:bg-slate-800/70 border border-slate-800/80 hover:border-indigo-500/30 shadow-sm shrink-0 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-inner shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "TF"}
              </div>
              {/* Name + role only on xl+ to maintain clean spacing */}
              <div className="hidden xl:flex flex-col text-left ml-2">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[85px] leading-tight">
                  {user?.name || "User"}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider leading-tight">
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
            </motion.div>

            {/* Logout button (smoothly unfolds "Sign Out" with Framer Motion) */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setLogoutHovered(true)}
              onMouseLeave={() => setLogoutHovered(false)}
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/80 hover:border-rose-500/30 transition-colors duration-200 focus:outline-none shrink-0"
            >
              <motion.div
                animate={{
                  x: logoutHovered ? -2 : 0,
                  scale: logoutHovered ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </motion.div>
              <motion.span
                initial={false}
                animate={{
                  width: logoutHovered ? "auto" : 0,
                  opacity: logoutHovered ? 1 : 0,
                  marginLeft: logoutHovered ? 6 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 27,
                  mass: 0.7,
                }}
                className="overflow-hidden whitespace-nowrap text-xs font-semibold text-rose-400"
              >
                Sign Out
              </motion.span>
            </motion.button>
          </div>

          {/* ── Mobile Actions (Presence + Menu Toggle) ──────── */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <PresenceChip />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>

        {/* ── Mobile Dropdown (Smooth Accordion Spring) ─────── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="md:hidden overflow-hidden py-4 border-t border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Navbar;
