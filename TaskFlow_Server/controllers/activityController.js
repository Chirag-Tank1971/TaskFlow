const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const Task = require("../models/Task");
const escapeRegex = require("../utils/escapeRegex");

/**
 * Timeline for one task, newest first.
 * Agents can only see their own tasks; admins/managers can see any, including deleted tasks.
 */
const getTaskActivity = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }

    if (req.user.role === "agent") {
      const task = await Task.findById(taskId).select("agent").lean();
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.agent?.toString() !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only view history of your own tasks" });
      }
    }

    const activities = await Activity.find({ task: taskId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ activities });
  } catch (error) {
    console.error("Task Activity Error:", error);
    res.status(500).json({ message: "Server error fetching task history" });
  }
};

/**
 * Audit log across all tasks (Admin/Manager only), with filters and pagination.
 * Query: type, actorRole, actorId, search (customer name), from, to (ISO dates), page, limit
 */
const getActivityFeed = async (req, res) => {
  try {
    const { type, actorRole, actorId, search, from, to, page, limit } = req.query;

    const query = {};
    if (type && Activity.ACTIVITY_TYPES.includes(type)) query.type = type;
    if (actorRole && ["admin", "manager", "agent", "system"].includes(actorRole)) query["actor.role"] = actorRole;
    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) query["actor.id"] = actorId;
    if (search && String(search).trim()) {
      query.taskName = new RegExp(escapeRegex(String(search).trim().slice(0, 100)), "i");
    }

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if ((fromDate && !isNaN(fromDate)) || (toDate && !isNaN(toDate))) {
      query.createdAt = {};
      if (fromDate && !isNaN(fromDate)) query.createdAt.$gte = fromDate;
      if (toDate && !isNaN(toDate)) query.createdAt.$lte = toDate;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const [total, activities] = await Promise.all([
      Activity.countDocuments(query),
      Activity.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;
    res.json({
      activities,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Activity Feed Error:", error);
    res.status(500).json({ message: "Server error fetching activity log" });
  }
};

module.exports = { getTaskActivity, getActivityFeed };
