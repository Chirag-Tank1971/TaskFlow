const mongoose = require("mongoose");
const Task = require("../models/Task");
const Agent = require("../models/Agent");
const escapeRegex = require("../utils/escapeRegex");
const { categorizeTask } = require("../services/categorizationService");
const {
  updateStatusSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
  createTaskSchema,
  updateTaskSchema,
  bulkAssignSchema,
  logCallSchema,
} = require("../validators/taskValidator");
const { CALL_OUTCOMES } = require("../constants/callOutcomes");
const { logActivity, actorFromReq, diffFields, SYSTEM_ACTOR } = require("../services/activityService");
const { indexLeads, removeLeads, INDEXED_OUTCOMES } = require("../services/leadIndexService");

// Store agents in the audit log as { id, name } so entries stay readable if the agent is deleted
const agentRef = (agent) => (agent ? { id: agent._id?.toString() || agent.toString(), name: agent.name || null } : null);

const firstIssue = (parseResult, fallback) =>
  parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || fallback;

/**
 * Load an agent that can receive work, or return an error message.
 */
const findAssignableAgent = async (agentId) => {
  const agent = await Agent.findById(agentId);
  if (!agent) return { error: "Agent not found" };
  if (agent.status === "Decommissioned") return { error: "Cannot assign tasks to a decommissioned agent" };
  return { agent };
};

/**
 * Pick the Available agent with the fewest open (pending / in-progress) tasks.
 */
const pickLeastLoadedAgent = async () => {
  const agents = await Agent.find({ status: "Available" }).select("_id");
  if (agents.length === 0) return null;

  const openCounts = await Task.aggregate([
    { $match: { agent: { $in: agents.map((a) => a._id) }, status: { $ne: "completed" } } },
    { $group: { _id: "$agent", count: { $sum: 1 } } },
  ]);
  const countByAgent = new Map(openCounts.map((c) => [c._id.toString(), c.count]));

  return agents.reduce((best, a) =>
    (countByAgent.get(a._id.toString()) || 0) < (countByAgent.get(best._id.toString()) || 0) ? a : best
  );
};

/**
 * Categorize a task in the background so the request isn't blocked by Gemini latency/rate limits.
 */
const categorizeInBackground = (taskId, notes, taskName) => {
  if (!notes) return;
  categorizeTask(notes)
    .then(async ({ category, source, confidence }) => {
      if (source !== "ai") return;
      // Only overwrite if nobody set a category manually in the meantime
      const result = await Task.updateOne(
        { _id: taskId, categorySource: { $ne: "manual" } },
        { $set: { category, categorySource: source, categoryConfidence: confidence, categorizedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        await logActivity({
          task: taskId,
          taskName,
          type: "categorized",
          actor: SYSTEM_ACTOR,
          changes: [{ field: "category", from: "General", to: category }],
          meta: { source: "ai" },
        });
      }
    })
    .catch((err) => console.error("Background categorization failed:", err.message));
};

/**
 * Retrieves tasks with search, category/status filters, and pagination.
 */
const getTasks = async (req, res) => {
  try {
    const { category, status, search, agentId, page, limit } = req.query;

    const query = {};
    if (category && category !== "All") query.category = category;
    if (status && status !== "All") query.status = status;
    if (agentId) query.agent = agentId;

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(String(search).trim().slice(0, 100)), "i");
      query.$or = [
        { firstName: searchRegex },
        { phone: searchRegex },
        { notes: searchRegex },
      ];
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));

    const totalTasks = await Task.countDocuments(query);

    let tasksQuery = Task.find(query)
      .populate("agent", "name email status")
      .sort({ createdAt: -1 });

    if (isPaginationRequested) {
      tasksQuery = tasksQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    } else {
      // Safety cap for unpaginated queries to prevent OOM
      tasksQuery = tasksQuery.limit(500);
    }

    const tasks = await tasksQuery;
    const totalPages = Math.ceil(totalTasks / limitNum) || 1;

    res.set("X-Total-Count", totalTasks.toString());
    res.set("X-Page", pageNum.toString());
    res.set("X-Total-Pages", totalPages.toString());

    if (isPaginationRequested) {
      return res.json({
        tasks,
        pagination: {
          total: totalTasks,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    }

    // Default return tasks directly for backward compatibility
    res.json(tasks);
  } catch (err) {
    console.error("Fetch Tasks Error:", err);
    res.status(500).json({ message: "Server error fetching tasks" });
  }
};

/**
 * Retrieves tasks assigned to a specific agent with optional filtering and pagination.
 */
const getTasksByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { category, status, search, page, limit } = req.query;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.json([]);
    }

    // Security check: Agents can only fetch their own tasks
    if (req.user && req.user.role === "agent" && req.user.id !== agentId) {
      return res.status(403).json({ message: "Forbidden: You can only view your own tasks" });
    }

    const agentExists = await Agent.findById(agentId);
    if (!agentExists) {
      return res.json([]);
    }

    const query = { agent: agentId };
    if (category && category !== "All") query.category = category;
    if (status && status !== "All") query.status = status;

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(String(search).trim().slice(0, 100)), "i");
      query.$or = [
        { firstName: searchRegex },
        { phone: searchRegex },
        { notes: searchRegex },
      ];
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));

    const totalTasks = await Task.countDocuments(query);

    let tasksQuery = Task.find(query)
      .populate("agent", "name email status")
      .sort({ createdAt: -1 });

    if (isPaginationRequested) {
      tasksQuery = tasksQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const tasks = await tasksQuery;
    const totalPages = Math.ceil(totalTasks / limitNum) || 1;

    res.set("X-Total-Count", totalTasks.toString());
    res.set("X-Page", pageNum.toString());
    res.set("X-Total-Pages", totalPages.toString());

    if (isPaginationRequested) {
      return res.json({
        tasks,
        pagination: {
          total: totalTasks,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    }

    res.json(tasks || []);
  } catch (err) {
    console.error("Fetch Agent Tasks Error:", err);
    res.status(500).json({ message: "Server error fetching agent tasks" });
  }
};

/**
 * Delete a single task with authorization check
 */
const deleteTasks = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Role check: An agent can only delete their own tasks
    if (req.user && req.user.role === "agent" && task.agent.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You cannot delete tasks assigned to other agents" });
    }

    await task.deleteOne();
    removeLeads([task._id]);

    await logActivity({
      task: task._id,
      taskName: task.firstName,
      type: "deleted",
      actor: actorFromReq(req),
      meta: { phone: task.phone, status: task.status, attempts: task.attempts },
    });

    res.json({ message: "Task deleted successfully", task });
  } catch (error) {
    console.error("Delete Task Error:", error);
    res.status(500).json({ message: "Server error deleting task" });
  }
};

/**
 * Update task status with validation and authorization
 */
const updateTasks = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || "Invalid status";
      return res.status(400).json({ message: msg });
    }

    const { status } = parseResult.data;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Role check: An agent can only update their own tasks
    if (req.user && req.user.role === "agent" && task.agent?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You cannot update tasks assigned to other agents" });
    }

    const previousStatus = task.status;
    task.status = status;

    if (status === "completed") {
      if (!task.completedDate) task.completedDate = new Date();
      task.callbackAt = null;
    } else if (previousStatus === "completed") {
      task.completedDate = null;
    }

    await task.save();
    await task.populate("agent", "name email status");

    if (previousStatus !== status) {
      await logActivity({
        task: task._id,
        taskName: task.firstName,
        type: "status_changed",
        actor: actorFromReq(req),
        changes: [{ field: "status", from: previousStatus, to: status }],
      });
    }

    res.status(200).json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update Task Error:", error);
    res.status(500).json({ message: "Server error updating task" });
  }
};

/**
 * Bulk delete tasks
 */
const bulkDeleteTasks = async (req, res) => {
  try {
    const parseResult = bulkDeleteSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || "Invalid payload";
      return res.status(400).json({ message: msg });
    }

    const { taskIds } = parseResult.data;

    if (taskIds.length > 200) {
      return res.status(400).json({ message: "Cannot delete more than 200 tasks in a single operation" });
    }

    const filter = { _id: { $in: taskIds } };

    // If agent, restrict strictly to their own tasks
    if (req.user && req.user.role === "agent") {
      filter.agent = req.user.id;
    }

    const doomed = await Task.find(filter).select("firstName phone status").lean();
    const deleteResult = await Task.deleteMany({ _id: { $in: doomed.map((t) => t._id) } });
    removeLeads(doomed.map((t) => t._id));

    const actor = actorFromReq(req);
    await logActivity(
      doomed.map((t) => ({
        task: t._id,
        taskName: t.firstName,
        type: "deleted",
        actor,
        meta: { phone: t.phone, status: t.status, bulk: true },
      }))
    );

    res.status(200).json({
      message: `Successfully deleted ${deleteResult.deletedCount} task(s)`,
      deletedCount: deleteResult.deletedCount,
      deletedTaskIds: taskIds,
    });
  } catch (error) {
    console.error("Bulk Delete Tasks Error:", error);
    res.status(500).json({ message: "Server error during bulk delete" });
  }
};

/**
 * Bulk update task status
 */
const bulkUpdateTaskStatus = async (req, res) => {
  try {
    const parseResult = bulkStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || "Invalid payload";
      return res.status(400).json({ message: msg });
    }

    const { taskIds, status } = parseResult.data;

    if (taskIds.length > 200) {
      return res.status(400).json({ message: "Cannot update more than 200 tasks in a single operation" });
    }

    const filter = { _id: { $in: taskIds } };
    if (req.user && req.user.role === "agent") {
      filter.agent = req.user.id;
    }

    const updateDoc = {
      $set: {
        status,
        updatedAt: new Date(),
        ...(status === "completed" ? { completedDate: new Date(), callbackAt: null } : { completedDate: null }),
      },
    };

    // Capture previous statuses so the audit log records real transitions only
    const changing = await Task.find({ ...filter, status: { $ne: status } }).select("firstName status").lean();
    const updateResult = await Task.updateMany(filter, updateDoc);

    const actor = actorFromReq(req);
    await logActivity(
      changing.map((t) => ({
        task: t._id,
        taskName: t.firstName,
        type: "status_changed",
        actor,
        changes: [{ field: "status", from: t.status, to: status }],
        meta: { bulk: true },
      }))
    );

    res.status(200).json({
      message: `Successfully updated ${updateResult.modifiedCount} task(s) to ${status}`,
      updatedCount: updateResult.modifiedCount,
      status,
    });
  } catch (error) {
    console.error("Bulk Update Status Error:", error);
    res.status(500).json({ message: "Server error during bulk status update" });
  }
};

/**
 * Create a single task manually (Admin/Manager only)
 */
const createTask = async (req, res) => {
  try {
    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: firstIssue(parseResult, "Invalid task data") });
    }

    const { firstName, phone, notes, agent: agentId, category } = parseResult.data;

    let agent;
    if (agentId) {
      const result = await findAssignableAgent(agentId);
      if (result.error) return res.status(400).json({ message: result.error });
      agent = result.agent;
    } else {
      agent = await pickLeastLoadedAgent();
      if (!agent) {
        return res.status(400).json({ message: "No available agents to assign this task to. Choose an agent manually." });
      }
    }

    const task = await Task.create({
      firstName,
      phone,
      notes,
      agent: agent._id,
      ...(category
        ? { category, categorySource: "manual", categorizedAt: new Date() }
        : { category: "General", categorySource: "default" }),
    });

    await logActivity({
      task: task._id,
      taskName: task.firstName,
      type: "created",
      actor: actorFromReq(req),
      meta: {
        agent: agentRef(agent),
        autoAssigned: !agentId,
        category: task.category,
      },
    });

    if (!category) categorizeInBackground(task._id, notes, task.firstName);

    await task.populate("agent", "name email status");
    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("Create Task Error:", error);
    res.status(500).json({ message: "Server error creating task" });
  }
};

/**
 * Edit task fields. Admins/managers can change everything (including reassignment);
 * agents can only edit the notes and status of their own tasks.
 */
const editTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }

    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: firstIssue(parseResult, "Invalid task data") });
    }
    const updates = parseResult.data;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAgent = req.user.role === "agent";
    if (isAgent) {
      if (task.agent?.toString() !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You cannot edit tasks assigned to other agents" });
      }
      const disallowed = Object.keys(updates).filter((k) => !["notes", "status"].includes(k));
      if (disallowed.length > 0) {
        return res.status(403).json({ message: `Agents cannot change: ${disallowed.join(", ")}` });
      }
    }

    const before = task.toObject();
    let reassignChange = null;

    if (updates.agent && updates.agent !== task.agent?.toString()) {
      const result = await findAssignableAgent(updates.agent);
      if (result.error) return res.status(400).json({ message: result.error });
      const previousAgent = task.agent ? await Agent.findById(task.agent).select("name").lean() : null;
      reassignChange = {
        field: "agent",
        from: agentRef(previousAgent || task.agent),
        to: agentRef(result.agent),
      };
      task.agent = result.agent._id;
    }

    ["firstName", "phone", "notes"].forEach((field) => {
      if (updates[field] !== undefined) task[field] = updates[field];
    });

    if (updates.category && updates.category !== task.category) {
      task.category = updates.category;
      task.categorySource = "manual";
      task.categoryConfidence = null;
      task.categorizedAt = new Date();
    }

    if (updates.status && updates.status !== task.status) {
      if (updates.status === "completed") {
        task.completedDate = new Date();
        task.callbackAt = null; // a closed task has nothing to call back
      } else if (task.status === "completed") {
        task.completedDate = null;
      }
      task.status = updates.status;
    }

    await task.save();
    await task.populate("agent", "name email status");

    // Split the edit into audit entries by kind, so the timeline reads naturally
    const actor = actorFromReq(req);
    const detailChanges = diffFields(before, task, ["firstName", "phone", "notes", "category"]);
    const statusChanges = diffFields(before, task, ["status"]);
    await logActivity([
      detailChanges.length && { task: task._id, taskName: task.firstName, type: "updated", actor, changes: detailChanges },
      statusChanges.length && { task: task._id, taskName: task.firstName, type: "status_changed", actor, changes: statusChanges },
      reassignChange && { task: task._id, taskName: task.firstName, type: "reassigned", actor, changes: [reassignChange] },
    ]);

    res.json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Edit Task Error:", error);
    res.status(500).json({ message: "Server error updating task" });
  }
};

/**
 * Reassign multiple tasks to one agent (Admin/Manager only)
 */
const bulkAssignTasks = async (req, res) => {
  try {
    const parseResult = bulkAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: firstIssue(parseResult, "Invalid payload") });
    }

    const { taskIds, agentId } = parseResult.data;

    const result = await findAssignableAgent(agentId);
    if (result.error) return res.status(400).json({ message: result.error });

    const moving = await Task.find({ _id: { $in: taskIds }, agent: { $ne: result.agent._id } })
      .select("firstName agent")
      .populate("agent", "name")
      .lean();
    const updateResult = await Task.updateMany({ _id: { $in: taskIds } }, { $set: { agent: result.agent._id } });

    const actor = actorFromReq(req);
    await logActivity(
      moving.map((t) => ({
        task: t._id,
        taskName: t.firstName,
        type: "reassigned",
        actor,
        changes: [{ field: "agent", from: agentRef(t.agent), to: agentRef(result.agent) }],
        meta: { bulk: true },
      }))
    );

    res.json({
      message: `Reassigned ${updateResult.modifiedCount} task(s) to ${result.agent.name}`,
      updatedCount: updateResult.modifiedCount,
      agent: { _id: result.agent._id, name: result.agent.name, email: result.agent.email, status: result.agent.status },
    });
  } catch (error) {
    console.error("Bulk Assign Error:", error);
    res.status(500).json({ message: "Server error during bulk reassignment" });
  }
};

/**
 * Record a call attempt on a task: outcome, optional note and (for callbacks) when to call again.
 * Agents can log calls on their own tasks; admins/managers on any task.
 */
const logCall = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }

    const parseResult = logCallSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: firstIssue(parseResult, "Invalid call details") });
    }
    const { outcome, note, callbackAt } = parseResult.data;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (req.user.role === "agent" && task.agent?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You cannot log calls on tasks assigned to other agents" });
    }

    const now = new Date();
    const scheduledCallback = outcome === "callback" ? callbackAt : null;
    const previousStatus = task.status;
    const previousOutcome = task.outcome;

    task.callLogs.push({
      outcome,
      note,
      callbackAt: scheduledCallback,
      loggedBy: req.user.id,
      loggedByRole: req.user.role,
      loggedByName: req.user.name,
    });
    task.outcome = outcome;
    task.callbackAt = scheduledCallback;
    task.attempts += 1;
    task.lastContactedAt = now;

    const nextStatus = CALL_OUTCOMES[outcome].status;
    if (nextStatus === "completed" && task.status !== "completed") {
      task.completedDate = now;
    } else if (nextStatus !== "completed") {
      task.completedDate = null;
    }
    task.status = nextStatus;

    await task.save();
    await task.populate("agent", "name email status");

    await logActivity({
      task: task._id,
      taskName: task.firstName,
      type: "call_logged",
      actor: actorFromReq(req),
      changes: previousStatus !== nextStatus ? [{ field: "status", from: previousStatus, to: nextStatus }] : [],
      meta: { outcome, note, callbackAt: scheduledCallback, attempt: task.attempts },
    });

    // Closed leads become examples for Call Assist (background; best-effort)
    if (INDEXED_OUTCOMES.includes(outcome) || INDEXED_OUTCOMES.includes(previousOutcome)) {
      indexLeads(task.toObject());
    }

    res.status(201).json({ message: "Call logged", task });
  } catch (error) {
    console.error("Log Call Error:", error);
    res.status(500).json({ message: "Server error logging call" });
  }
};

module.exports = {
  logCall,
  getTasks,
  getTasksByAgent,
  deleteTasks,
  updateTasks,
  bulkDeleteTasks,
  bulkUpdateTaskStatus,
  createTask,
  editTask,
  bulkAssignTasks,
};
