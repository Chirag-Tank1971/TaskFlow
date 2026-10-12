const express = require("express");
const { 
  getTasks, 
  getTasksByAgent, 
  deleteTasks, 
  updateTasks,
  bulkDeleteTasks,
  bulkUpdateTaskStatus,
  createTask,
  editTask,
  bulkAssignTasks,
  logCall,
} = require("../controllers/taskController"); // Import task controllers
const authenticate = require("../middleware/authMiddleware"); // Import authentication middleware
const authorize = require("../middleware/authorize");
const { getTaskActivity } = require("../controllers/activityController");
const { callAssist } = require("../controllers/knowledgeController");
const { getActiveLocks } = require("../services/socketManager");

const router = express.Router(); // Create an Express router instance

/**
 * @route   GET /api/tasks/locks/active
 * @desc    Fetch active lead collision locks
 * @access  Private
 */
router.get("/locks/active", authenticate, (req, res) => {
  res.json({ locks: getActiveLocks() });
});

/**
 * @route   GET /api/tasks
 * @desc    Fetch all tasks with agent details
 * @access  Private (requires authentication)
 */
router.get("/", authenticate, getTasks);

/**
 * @route   POST /api/tasks
 * @desc    Create a single task (auto-assigns and AI-categorizes when not specified)
 * @access  Private (Admin/Manager only)
 */
router.post("/", authenticate, authorize(["admin", "manager"]), createTask);

/**
 * @route   POST /api/tasks/bulk/assign
 * @desc    Reassign multiple tasks to one agent
 * @access  Private (Admin/Manager only)
 */
router.post("/bulk/assign", authenticate, authorize(["admin", "manager"]), bulkAssignTasks);

/**
 * @route   DELETE /api/tasks/bulk
 * @desc    Delete multiple tasks (bulk operation)
 * @access  Private (requires authentication, agents only)
 */
router.delete("/bulk", authenticate, bulkDeleteTasks);

/**
 * @route   POST /api/tasks/bulk/status
 * @desc    Update status for multiple tasks (bulk operation)
 * @access  Private (requires authentication, agents only)
 */
router.post("/bulk/status", authenticate, bulkUpdateTaskStatus);

/**
 * @route   GET /api/tasks/:agentId
 * @desc    Fetch tasks assigned to a specific agent
 * @access  Private (requires authentication)
 */
router.get("/:agentId", authenticate, getTasksByAgent);

/**
 * @route   DELETE /api/tasks/:taskId
 * @desc    Delete a single task
 * @access  Private (requires authentication)
 */
router.delete("/:taskId", authenticate, deleteTasks);

/**
 * @route   POST /api/tasks/:taskId
 * @desc    Update a single task status
 * @access  Private (requires authentication)
 */
router.post("/:taskId", authenticate, updateTasks);

/**
 * @route   PATCH /api/tasks/:taskId
 * @desc    Edit task details / reassign (agents: notes and status of own tasks only)
 * @access  Private (requires authentication)
 */
router.patch("/:taskId", authenticate, editTask);

/**
 * @route   POST /api/tasks/:taskId/calls
 * @desc    Log a call attempt (outcome, note, optional callback time)
 * @access  Private (agents: own tasks only)
 */
router.post("/:taskId/calls", authenticate, logCall);

/**
 * @route   GET /api/tasks/:taskId/activity
 * @desc    Full history of a task (edits, status changes, reassignments, calls)
 * @access  Private (agents: own tasks only)
 */
router.get("/:taskId/activity", authenticate, getTaskActivity);

/**
 * @route   POST /api/tasks/:taskId/assist
 * @desc    AI Call Assist: talking points from lead history, similar converted leads and the knowledge base
 * @access  Private (agents: own tasks only)
 */
router.post("/:taskId/assist", authenticate, callAssist);

module.exports = router; // Export the router for use in the main app
