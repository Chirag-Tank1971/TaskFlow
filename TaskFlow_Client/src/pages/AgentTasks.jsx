import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/layout/AppLayout";
import CategoryFilter from "../components/CategoryFilter";
import TaskCard from "../components/tasks/TaskCard";
import TaskModal from "../components/tasks/TaskModal";
import TaskFormModal from "../components/tasks/TaskFormModal";
import LogCallModal from "../components/tasks/LogCallModal";
import { hasOpenCallback, isCallbackDue } from "../constants/callOutcomes";
import ConfirmModal from "../components/common/ConfirmModal";
import { toast } from "react-toastify";
import {
  Search,
  CheckSquare,
  Trash2,
  PlayCircle,
  CheckCircle2,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Plus,
  UserCheck,
  CalendarClock,
} from "lucide-react";

// "callbacks" is a virtual filter: open tasks with a scheduled callback, soonest first
const STATUS_FILTERS = ["All", "pending", "in-progress", "completed", "callbacks"];

const AgentTasks = () => {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchParams] = useSearchParams();
  const [selectedStatus, setSelectedStatus] = useState(() =>
    STATUS_FILTERS.includes(searchParams.get("view")) ? searchParams.get("view") : "All"
  );
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Modals
  const [activeModalTask, setActiveModalTask] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  // Create/edit form: null = closed, { task: null } = create, { task } = edit
  const [formState, setFormState] = useState(null);
  const [logCallTask, setLogCallTask] = useState(null);

  // Agents list for assignment (admins only)
  const [agents, setAgents] = useState([]);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const agentId = user?._id || user?.id;

  useEffect(() => {
    fetchTasks();
  }, [agentId]);

  useEffect(() => {
    if (!isAdmin) return;
    axios
      .get(`${API_BASE_URL}/api/agents`)
      .then((res) => setAgents(Array.isArray(res.data) ? res.data : []))
      .catch(() => toast.error("Failed to load agents"));
  }, [isAdmin]);

  // Add a newly created task or replace an edited one in place
  const handleTaskSaved = (savedTask, isEdit) => {
    if (isEdit) {
      setTasks((prev) => prev.map((t) => (t._id === savedTask._id ? savedTask : t)));
    } else {
      setTasks((prev) => [savedTask, ...prev]);
      setPage(1);
    }
  };

  // Handle bulk reassignment
  const handleBulkAssign = async () => {
    if (selectedTaskIds.length === 0 || !bulkAssignAgentId) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tasks/bulk/assign`, {
        taskIds: selectedTaskIds,
        agentId: bulkAssignAgentId,
      });
      const newAgent = res.data.agent;
      setTasks((prev) =>
        prev.map((t) => (selectedTaskIds.includes(t._id) ? { ...t, agent: newAgent } : t))
      );
      toast.success(res.data.message);
      setSelectedTaskIds([]);
      setBulkAssignAgentId("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk reassignment failed");
    }
  };

  const fetchTasks = async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      // If admin, can fetch all tasks, otherwise fetch agent's tasks
      const url = isAdmin
        ? `${API_BASE_URL}/api/tasks`
        : `${API_BASE_URL}/api/tasks/${agentId}`;

      const res = await axios.get(url);
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.tasks
        ? res.data.tasks
        : [];
      setTasks(data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error(err.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  // Replace a task in the list after a call is logged
  const handleCallLogged = (updatedTask) => {
    setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)));
  };

  // Re-evaluate "due" callbacks every minute while the page is open
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const dueCallbackCount = useMemo(() => tasks.filter((t) => isCallbackDue(t, now)).length, [tasks, now]);

  // Filter tasks client-side for immediate responsive typing
  const filteredTasks = useMemo(() => {
    const result = tasks.filter((t) => {
      // Category filter
      if (selectedCategory !== "All" && t.category !== selectedCategory) return false;
      // Status filter
      if (selectedStatus === "callbacks") {
        if (!hasOpenCallback(t)) return false;
      } else if (selectedStatus !== "All" && t.status !== selectedStatus) return false;
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.firstName?.toLowerCase().includes(q);
        const matchesPhone = t.phone?.includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesNotes) return false;
      }
      return true;
    });
    if (selectedStatus === "callbacks") {
      result.sort((a, b) => new Date(a.callbackAt) - new Date(b.callbackAt));
    }
    return result;
  }, [tasks, selectedCategory, selectedStatus, searchQuery]);

  // Paginated slice
  const totalPages = Math.ceil(filteredTasks.length / limit) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredTasks.slice(start, start + limit);
  }, [filteredTasks, page, limit]);

  // Handle single status change
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.post(`${API_BASE_URL}/api/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success(`Task moved to ${newStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Status update failed");
    }
  };

  // Handle single delete
  const handleDeleteTask = async () => {
    if (!deleteConfirmId) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/tasks/${deleteConfirmId}`);
      setTasks((prev) => prev.filter((t) => t._id !== deleteConfirmId));
      setSelectedTaskIds((prev) => prev.filter((id) => id !== deleteConfirmId));
      toast.success("Task deleted successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Task delete failed");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Handle bulk status change
  const handleBulkStatus = async (newStatus) => {
    if (selectedTaskIds.length === 0) return;
    try {
      await axios.post(`${API_BASE_URL}/api/tasks/bulk/status`, {
        taskIds: selectedTaskIds,
        status: newStatus,
      });
      setTasks((prev) =>
        prev.map((t) =>
          selectedTaskIds.includes(t._id) ? { ...t, status: newStatus } : t
        )
      );
      toast.success(`Updated ${selectedTaskIds.length} tasks to ${newStatus}`);
      setSelectedTaskIds([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk update failed");
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/tasks/bulk`, {
        data: { taskIds: selectedTaskIds },
      });
      setTasks((prev) => prev.filter((t) => !selectedTaskIds.includes(t._id)));
      toast.success(`Deleted ${selectedTaskIds.length} tasks`);
      setSelectedTaskIds([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  // Selection handlers
  const toggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.length === paginatedTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(paginatedTasks.map((t) => t._id));
    }
  };

  return (
    <AppLayout
      title="Task Operations Workspace"
      subtitle="Search, filter, categorize, and execute work orders with AI categorization insights"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl glass-panel text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setFormState({ task: null })}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          )}
        </div>
      }
    >
      {/* Category Pills Bar */}
      <div className="mb-6">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={(cat) => {
            setSelectedCategory(cat);
            setPage(1);
          }}
        />
      </div>

      {/* Control Strip: Search + Status Tabs + View Mode */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks by customer name, phone, or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
          />
        </div>

        {/* Status Tabs + Layout Switcher */}
        <div className="flex items-center gap-3">
          {/* Status Pills */}
          <div className="glass-panel p-1 rounded-xl flex items-center gap-1 border border-slate-800">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedStatus(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  selectedStatus === st
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "in-progress" ? "In Progress" : st}
                {st === "callbacks" && dueCallbackCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                    {dueCallbackCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Grid / List Mode */}
          <div className="glass-panel p-1 rounded-xl flex items-center gap-1 border border-slate-800">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs ${
                viewMode === "grid" ? "bg-slate-800 text-indigo-400" : "text-slate-400"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg text-xs ${
                viewMode === "list" ? "bg-slate-800 text-indigo-400" : "text-slate-400"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Due Callbacks Banner */}
      {dueCallbackCount > 0 && selectedStatus !== "callbacks" && (
        <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-rose-200">
            <CalendarClock className="w-4 h-4 text-rose-400" />
            <span>
              <strong>{dueCallbackCount}</strong> callback{dueCallbackCount > 1 ? "s are" : " is"} due now
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedStatus("callbacks");
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
          >
            View Callbacks
          </button>
        </div>
      )}

      {/* Floating Bulk Action Bar (Visible when tasks are selected) */}
      {selectedTaskIds.length > 0 && (
        <div className="glass-panel border border-indigo-500/40 bg-indigo-950/40 rounded-xl p-3 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-indigo-950/40 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white bg-indigo-600 px-2 py-0.5 rounded-md">
              {selectedTaskIds.length} selected
            </span>
            <span className="text-xs text-slate-300">Quick bulk operations:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkAssignAgentId}
                  onChange={(e) => setBulkAssignAgentId(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Reassign to…</option>
                  {agents
                    .filter((a) => a.status !== "Decommissioned")
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignAgentId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Reassign</span>
                </button>
              </div>
            )}
            <button
              onClick={() => handleBulkStatus("in-progress")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Mark In Progress</span>
            </button>
            <button
              onClick={() => handleBulkStatus("completed")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Completed</span>
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => setSelectedTaskIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Select All Toggle for Current Page */}
      {paginatedTasks.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 mb-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={
                paginatedTasks.length > 0 &&
                selectedTaskIds.length === paginatedTasks.length
              }
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Select all on page ({paginatedTasks.length})</span>
          </label>
          <span>
            Showing {filteredTasks.length ? (page - 1) * limit + 1 : 0} -{" "}
            {Math.min(page * limit, filteredTasks.length)} of {filteredTasks.length} tasks
          </span>
        </div>
      )}

      {/* Tasks Render: Grid vs List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400">Loading tasks...</span>
        </div>
      ) : paginatedTasks.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {paginatedTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isSelected={selectedTaskIds.includes(task._id)}
                onSelect={toggleSelectTask}
                onStatusChange={handleStatusChange}
                onViewDetails={setActiveModalTask}
                onLogCall={setLogCallTask}
                onEdit={(t) => setFormState({ task: t })}
                onDelete={setDeleteConfirmId}
                canDelete={true}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {paginatedTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isSelected={selectedTaskIds.includes(task._id)}
                onSelect={toggleSelectTask}
                onStatusChange={handleStatusChange}
                onViewDetails={setActiveModalTask}
                onLogCall={setLogCallTask}
                onEdit={(t) => setFormState({ task: t })}
                onDelete={setDeleteConfirmId}
                canDelete={true}
              />
            ))}
          </div>
        )
      ) : (
        <div className="glass-panel rounded-2xl py-16 text-center text-slate-500 text-sm border border-slate-800">
          No tasks matched your current filter or search criteria.
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-400 px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Task Details Modal */}
      <TaskModal
        task={activeModalTask}
        isOpen={!!activeModalTask}
        onClose={() => setActiveModalTask(null)}
        onStatusChange={handleStatusChange}
        onLogCall={setLogCallTask}
      />

      {/* Log Call Modal */}
      <LogCallModal
        task={logCallTask}
        isOpen={!!logCallTask}
        onClose={() => setLogCallTask(null)}
        onLogged={handleCallLogged}
      />

      {/* Create / Edit Task Modal */}
      <TaskFormModal
        isOpen={!!formState}
        task={formState?.task || null}
        agents={agents}
        isAdmin={isAdmin}
        onClose={() => setFormState(null)}
        onSaved={handleTaskSaved}
      />

      {/* Delete Single Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete Task"
        isDanger={true}
      />

      {/* Bulk Delete Confirm Modal */}
      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedTaskIds.length} Tasks`}
        message="Are you sure you want to permanently delete all selected tasks? This cannot be undone."
        confirmText="Delete Selected"
        isDanger={true}
      />
    </AppLayout>
  );
};

export default AgentTasks;
