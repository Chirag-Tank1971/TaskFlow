import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import {
  CheckSquare,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  UserCheck,
  Sparkles,
} from "lucide-react";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState("admin"); // 'admin' | 'agent'
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in both email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password, accountType },
        { withCredentials: true }
      );

      const { user } = res.data;
      login(user);

      toast.success(`Welcome back, ${user.name || "User"}!`);

      if (user.role === "agent" || accountType === "agent") {
        navigate("/agent/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-600/30 mb-3">
            <CheckSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            TaskFlow Platform
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Intelligent Task Operations & AI Categorization
          </p>
        </div>

        {/* Auth Box */}
        <div className="glass-panel rounded-2xl p-7 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => setAccountType("admin")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                accountType === "admin"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin / Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("agent")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                accountType === "agent"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Field Agent</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder={accountType === "agent" ? "agent@company.com" : "admin@taskflow.io"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In as {accountType === "admin" ? "Admin" : "Agent"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note & Signup link */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
            {accountType === "admin" ? (
              <span>
                Need an admin account?{" "}
                <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                  Register Admin
                </Link>
              </span>
            ) : (
              <span>
                Register as a field agent?{" "}
                <Link to="/agent/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                  Agent Sign Up
                </Link>
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Gemini AI Task Distribution Active</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
