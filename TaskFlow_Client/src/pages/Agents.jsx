import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import AppLayout from "../components/layout/AppLayout";
import ConfirmModal from "../components/common/ConfirmModal";
import { toast } from "react-toastify";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Shield,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  RefreshCw,
} from "lucide-react";

const Agents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Add Agent Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
  });

  // Edit Agent Modal
  const [editAgent, setEditAgent] = useState(null);

  // Delete Confirm
  const [deleteAgentId, setDeleteAgentId] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/agents`);
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgent.name || !newAgent.email || !newAgent.password || !newAgent.mobile) {
      toast.error("Please fill in all agent fields");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/agents`, newAgent);
      toast.success("Agent added successfully");
      setIsAddOpen(false);
      setNewAgent({ name: "", email: "", mobile: "", password: "" });
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error adding agent");
    }
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();
    if (!editAgent) return;

    try {
      await axios.post(`${API_BASE_URL}/api/agents/update`, {
        agentId: editAgent._id,
        name: editAgent.name,
        mobile: editAgent.mobile,
        status: editAgent.status,
      });
      toast.success("Agent updated successfully");
      setEditAgent(null);
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating agent");
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteAgentId) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/agents/${deleteAgentId}`);
      toast.success("Agent deleted successfully");
      setAgents((prev) => prev.filter((a) => a._id !== deleteAgentId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Error deleting agent");
    } finally {
      setDeleteAgentId(null);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (statusFilter !== "All" && agent.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = agent.name?.toLowerCase().includes(q);
      const matchEmail = agent.email?.toLowerCase().includes(q);
      const matchMobile = agent.mobile?.includes(q);
      if (!matchName && !matchEmail && !matchMobile) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "Available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Available
          </span>
        );
      case "Not-Available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Busy / Away
          </span>
        );
      case "Decommissioned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Decommissioned
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <AppLayout
      title="Agent Workforce Directory"
      subtitle="Manage field and support agents, monitor status availability, and configure team credentials"
      action={
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Agent</span>
        </button>
      }
    >
      {/* Control Strip: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search agents by name, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["All", "Available", "Not-Available", "Decommissioned"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "glass-panel text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400">Loading agents...</span>
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {filteredAgents.map((agent) => (
            <div
              key={agent._id}
              className="glass-panel rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700 transition-all duration-200 shadow-xl flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-900/60 to-slate-800 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 shadow-inner">
                      {agent.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        {agent.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Shield className="w-3 h-3 text-cyan-400" />
                        <span>Field Operations</span>
                      </span>
                    </div>
                  </div>

                  <div>{getStatusBadge(agent.status)}</div>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-800/60 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{agent.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{agent.mobile || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  Joined {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "Recent"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditAgent(agent)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Edit Agent"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteAgentId(agent._id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl py-16 text-center text-slate-500 text-sm border border-slate-800">
          No agents found matching your query.
        </div>
      )}

      {/* Add Agent Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Add New Agent
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="agent@company.com"
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={newAgent.mobile}
                  onChange={(e) => setNewAgent({ ...newAgent, mobile: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newAgent.password}
                  onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  Save Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {editAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Edit Agent Details
              </h2>
              <button
                onClick={() => setEditAgent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAgent} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editAgent.name}
                  onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={editAgent.mobile}
                  onChange={(e) => setEditAgent({ ...editAgent, mobile: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Operational Status
                </label>
                <select
                  value={editAgent.status}
                  onChange={(e) => setEditAgent({ ...editAgent, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Available">Available (Accepts tasks)</option>
                  <option value="Not-Available">Not-Available (Busy)</option>
                  <option value="Decommissioned">Decommissioned</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditAgent(null)}
                  className="px-4 py-2 font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteAgentId}
        onClose={() => setDeleteAgentId(null)}
        onConfirm={handleDeleteAgent}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? Assigned tasks will need to be reassigned."
        confirmText="Delete Agent"
        isDanger={true}
      />
    </AppLayout>
  );
};

export default Agents;
