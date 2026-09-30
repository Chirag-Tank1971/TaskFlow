import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { CheckSquare, Lock, Mail, ArrowRight, UserCheck } from "lucide-react";

const AgentLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        { email, password, accountType: "agent" },
        { withCredentials: true }
      );

      const { user } = res.data;
      login(user);
      toast.success(`Welcome back, ${user.name}!`);
      navigate("/agent/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid agent credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-xl shadow-cyan-600/30 mb-3">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Field Agent Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access assigned task pipelines, customer records, and status trackers
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-7 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Agent Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="agent@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
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
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In as Agent</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <Link to="/" className="text-slate-400 hover:text-white">
              &larr; Admin Portal
            </Link>
            <Link to="/agent/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              New Agent? Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLogin;
